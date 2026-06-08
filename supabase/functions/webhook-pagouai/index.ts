import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratar requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar o cliente Supabase com a chave Service Role (bypassa RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? "",
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    )

    let payload = {}
    try {
      payload = await req.json()
    } catch (e) {
      console.log("Corpo da requisição vazio ou não é JSON. Assumindo payload vazio.")
    }
    console.log("Webhook recebido:", payload)

    const { event, customer } = payload

    // Tratar eventos de teste ou de ping de forma amigável (garante aprovação nos testes da gateway)
    if (!event || event === 'ping' || event.includes('test') || event === 'integration.test') {
      return new Response(JSON.stringify({ message: "Ping recebido com sucesso. Webhook ativo!" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Verificar se o pagamento do Pix foi confirmado
    if (event === 'pix.paid' || event === 'payment.paid') {
      const email = customer?.email?.trim().toLowerCase()
      const nome = customer?.name?.trim()

      if (!email) {
        return new Response(JSON.stringify({ error: "Email do cliente não fornecido no payload." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Detectar o plano comprado
      let plano = 'Completo' // Fallback padrão
      let planOrProductNames: string[] = []

      // Coletar possíveis locais onde o nome do plano/produto/oferta pode vir
      const possibleNamePaths = [
        payload.payment?.product_name,
        payload.product_name,
        payload.data?.product_name,
        payload.payment?.plan_name,
        payload.plan_name,
        payload.data?.plan_name,
        payload.payment?.offer_name,
        payload.offer_name,
        payload.data?.offer_name,
        payload.payment?.title,
        payload.title,
        payload.data?.title,
        customer?.product_name
      ]

      possibleNamePaths.forEach(name => {
        if (typeof name === 'string' && name.trim() !== '') {
          planOrProductNames.push(name.toLowerCase())
        }
      })

      // Verificar também se há itens na compra
      const items = payload.payment?.items ?? payload.items ?? payload.data?.items
      if (Array.isArray(items)) {
        items.forEach(item => {
          const itemName = item?.name ?? item?.title ?? item?.product_name
          if (typeof itemName === 'string' && itemName.trim() !== '') {
            planOrProductNames.push(itemName.toLowerCase())
          }
        })
      }

      console.log(`Nomes de planos/produtos encontrados no payload:`, planOrProductNames)

      let foundBasicInName = false
      let foundCompleteInName = false

      planOrProductNames.forEach(name => {
        if (name.includes('básico') || name.includes('basico')) {
          foundBasicInName = true
        }
        if (name.includes('completo')) {
          foundCompleteInName = true
        }
      })

      if (foundBasicInName) {
        plano = 'Básico'
      } else if (foundCompleteInName) {
        plano = 'Completo'
      } else {
        // Fallback para detecção por valor se não encontrar nenhuma palavra-chave nos nomes
        const rawAmount = payload.data?.amount ?? 
                          payload.payment?.amount ?? 
                          payload.amount ?? 
                          payload.data?.value ?? 
                          payload.payment?.value ?? 
                          payload.value
        
        console.log(`Fallback para detecção por valor (rawAmount):`, rawAmount)
        
        if (rawAmount !== undefined && rawAmount !== null) {
          const amountNum = Number(rawAmount)
          // 1000 centavos ou R$ 10.00
          if (amountNum === 1000 || amountNum === 10 || amountNum === 10.00) {
            plano = 'Básico'
          }
        }
      }
      
      console.log(`Plano final identificado para ${email}:`, plano)

      // Realiza o upsert (insere novo ou atualiza se o e-mail já existir)
      const { data, error } = await supabaseClient
        .from('alunos')
        .upsert(
          { email: email, nome: nome, plano: plano },
          { onConflict: 'email' }
        )
        .select()

      if (error) {
        console.error("Erro ao salvar aluno no banco:", error)
        return new Response(JSON.stringify({ error: "Erro ao salvar no banco de dados.", details: error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      console.log(`Aluno ${email} cadastrado/atualizado na tabela pública com sucesso!`, data)

      // O link de acesso à área de membros é direto (sem autenticação de convite com senha via Supabase Auth)
      const siteUrl = "https://drenagemlinfatica.netlify.app/area-de-membros/"

      // Disparar o e-mail personalizado usando a API do Resend
      const resendToken = "re_3jsNvZDB_C8nZfu62qGF2NmJ9S1BqsgRN"
      const emailHtml = getEmailHtml(nome, siteUrl)

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Drenagem Linfática <acesso@drenagemlinfatica.hyzencompra.shop>",
            to: [email],
            subject: "Seu acesso à Área de Membros está liberado! 🎓",
            html: emailHtml
          })
        })

        const resendResult = await resendResponse.json()
        if (!resendResponse.ok) throw new Error(JSON.stringify(resendResult))
        console.log("E-mail enviado com sucesso via Resend:", resendResult)
      } catch (emailErr) {
        console.error("Erro ao enviar e-mail via Resend:", emailErr)
      }

      return new Response(JSON.stringify({ message: "Aluno cadastrado e e-mail disparado via Resend!", data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({ message: "Evento ignorado (não é de pagamento aprovado)." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Erro interno no processamento do webhook:", error)
    return new Response(JSON.stringify({ error: "Erro interno no servidor.", message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

function getEmailHtml(name: string, actionLink: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesso Liberado | Drenagem Linfática Ilustrada</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding-bottom: 40px;
      padding-top: 40px;
    }
    .main-table {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 82, 255, 0.03);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0052FF 0%, #0033AA 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header-logo {
      font-size: 50px;
      line-height: 1;
      margin-bottom: 10px;
    }
    .header h1 {
      color: #ffffff;
      font-family: 'Poppins', 'Helvetica Neue', Arial, sans-serif;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .content {
      padding: 40px 30px;
      background-color: #ffffff;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 25px;
    }
    .button-container {
      text-align: center;
      margin-top: 30px;
      margin-bottom: 35px;
    }
    .cta-button {
      background-color: #0052FF;
      color: #ffffff !important;
      display: inline-block;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 82, 255, 0.25);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 10px 0;
      line-height: 1.5;
    }
    .footer a {
      color: #0052FF;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" align="center">
      <!-- HEADER -->
      <tr>
        <td class="header">
          <div class="header-logo">🎓</div>
          <h1>Área de Membros</h1>
        </td>
      </tr>
      
      <!-- CONTENT -->
      <tr>
        <td class="content">
          <h2>Seu acesso foi liberado! 🎉</h2>
          <p>Olá, <strong>${name || 'Aluno(a)'}</strong>,</p>
          <p>Parabéns pela aquisição do <strong>Guia +300 Técnicas de Drenagem Linfática Ilustradas</strong>! Seu acesso exclusivo à nossa área de membros privada já está liberado.</p>
          
          <!-- Box Informativo de Alerta (Login Sem Senha) -->
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 25px; border-radius: 6px;">
            <p style="margin: 0; font-size: 15px; color: #991b1b; line-height: 1.5; font-weight: 500;">
              <strong>⚠️ IMPORTANTE: LOGIN SEM SENHA</strong><br>
              A nossa área de membros <strong>NÃO possui senha</strong>. Para fazer o login e acessar os seus materiais, você deve informar <strong>APENAS o seu e-mail de compra</strong>. Não é necessário criar ou digitar nenhuma senha!
            </p>
          </div>

          <p>Para começar os seus estudos e ter acesso aos materiais de bônus e emissão do seu certificado, clique no botão abaixo para entrar na área de membros:</p>
          
          <div class="button-container">
            <a href="${actionLink}" class="cta-button" style="color: #ffffff;">Acessar Área de Membros</a>
          </div>
          
          <p style="margin-bottom: 0; font-size: 14px; color: #64748b; font-style: italic;">
            Obs: Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador: <br>
            <a href="${actionLink}" style="color: #0052FF; word-break: break-all;">${actionLink}</a>
          </p>
        </td>
      </tr>
      
      <!-- FOOTER -->
      <tr>
        <td class="footer">
          <p>Você recebeu este e-mail porque realizou a compra do material digital de Drenagem Linfática.</p>
          <p>&copy; 2026 Guia de Drenagem Linfática. Todos os direitos reservados.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`
}
