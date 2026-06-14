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

    // Logar webhook bruto no banco de dados para depuração
    try {
      await supabaseClient
        .from('webhook_logs')
        .insert({ payload: payload })
    } catch (logErr) {
      console.error("Erro ao salvar log do webhook:", logErr)
    }

    const eventType = (payload.event || payload.data?.event_type || "")
    const paymentStatus = (payload.payment?.status || payload.data?.status || payload.status || "")

    const isTestEvent = !eventType || eventType === 'ping' || eventType.includes('test') || eventType === 'integration.test';

    // Tratar eventos de teste ou de ping de forma amigável (garante aprovação nos testes da gateway)
    if (isTestEvent) {
      return new Response(JSON.stringify({ message: "Ping recebido com sucesso. Webhook ativo!" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const isPaid = (
      eventType === 'pix.paid' ||
      eventType === 'card.paid' ||
      eventType === 'payment.paid' ||
      eventType === 'transaction.paid' ||
      eventType === 'payment.approved' ||
      eventType === 'transaction.approved' ||
      eventType.endsWith('.paid') ||
      eventType.endsWith('.approved') ||
      paymentStatus === 'paid' ||
      paymentStatus === 'approved'
    );

    // Verificar se o pagamento foi confirmado
    if (isPaid) {
      const customerObj = payload.customer ?? payload.data?.customer ?? payload.payment?.customer ?? payload.data?.client ?? payload.client
      const email = customerObj?.email?.trim().toLowerCase()
      const nome = customerObj?.name?.trim() ?? customerObj?.nome?.trim()

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
        customerObj?.product_name,
        payload.product?.title,
        payload.product?.name,
        payload.payment?.product?.title,
        payload.payment?.product?.name
      ]

      possibleNamePaths.forEach(name => {
        if (typeof name === 'string' && name.trim() !== '') {
          planOrProductNames.push(name.toLowerCase())
        }
      })

      // Verificar também se há itens na compra
      const items = payload.payment?.items ?? payload.items ?? payload.data?.items ?? payload.products ?? payload.payment?.products
      if (Array.isArray(items)) {
        items.forEach(item => {
          const itemName = item?.name ?? item?.title ?? item?.product_name ?? item?.product?.name ?? item?.product?.title
          if (typeof itemName === 'string' && itemName.trim() !== '') {
            planOrProductNames.push(itemName.toLowerCase())
          }
        })
      }

      console.log(`Nomes de planos/produtos encontrados no payload:`, planOrProductNames)

      // Verificar se a compra pertence a esta oferta (Drenagem Linfática ou Massagens Emagrecedoras)
      let isDrenagem = false

      const drenagemKeywords = ['drenagem', 'linfática', 'linfatica', 'técnicas', 'tecnicas', 'dl-300', 'massagens', 'emagrecedoras']

      planOrProductNames.forEach(name => {
        drenagemKeywords.forEach(kw => {
          if (name.includes(kw)) isDrenagem = true
        })
      })

      if (!isDrenagem) {
        console.log(`Compra ignorada: Produto não pertence à oferta de Drenagem Linfática ou Massagens. Nomes encontrados:`, planOrProductNames)
        return new Response(JSON.stringify({ 
          message: "Evento ignorado (produto não pertence a Drenagem Linfática).",
          detected_names: planOrProductNames 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // 1. Verificar se o aluno já existe
      const { data: alunoExistente, error: findError } = await supabaseClient
        .from('alunos')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (findError) {
        console.error("Erro ao buscar aluno existente:", findError)
      }

      // 2. Identificar se comprou os adicionais (orderbumps)
      let comprouOrderbump = false
      let comprouPack2in1 = false
      planOrProductNames.forEach(name => {
        if (name.includes('massagens') || name.includes('emagrecedoras')) {
          comprouOrderbump = true
        }
        if (name.includes('esculpimento') || name.includes('relaxamento') || name.includes('pack 2 em 1') || name.includes('pack_2em1') || name.includes('pack')) {
          comprouPack2in1 = true
        }
      })

      // 3. Determinar o plano comprado (apenas se veio no payload)
      let planoIdentificado: string | null = null
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
        planoIdentificado = 'Básico'
      } else if (foundCompleteInName) {
        planoIdentificado = 'Completo'
      } else {
        // Fallback por valor da transação caso a gateway envie valores padronizados
        const rawAmount = payload.data?.amount ?? 
                          payload.payment?.amount ?? 
                          payload.amount ?? 
                          payload.data?.value ?? 
                          payload.payment?.value ?? 
                          payload.value
        
        if (rawAmount !== undefined && rawAmount !== null) {
          const amountNum = Number(rawAmount)
          if (amountNum === 1000 || amountNum === 10 || amountNum === 10.00) {
            planoIdentificado = 'Básico'
          } else if (amountNum === 2790 || amountNum === 27.90 || amountNum === 1490 || amountNum === 14.90) {
            planoIdentificado = 'Completo'
          }
        }
      }

      let dataFinal: any = null
      let dbError: any = null

      if (alunoExistente) {
        // Aluno já existe: atualiza apenas os campos necessários (preserva o plano caso seja compra avulsa do orderbump)
        const updatePayload: any = {}
        if (nome) updatePayload.nome = nome
        if (planoIdentificado) updatePayload.plano = planoIdentificado
        if (comprouOrderbump) updatePayload.orderbump = true
        if (comprouPack2in1) updatePayload.orderbump_pack2in1 = true

        console.log(`Aluno já existe. Atualizando dados:`, updatePayload)

        const { data, error } = await supabaseClient
          .from('alunos')
          .update(updatePayload)
          .eq('email', email)
          .select()

        dataFinal = data
        dbError = error
      } else {
        // Aluno novo: insere registro completo
        const insertPayload = {
          email: email,
          nome: nome,
          plano: planoIdentificado ?? 'Completo', // fallback Completo se não identificado
          orderbump: comprouOrderbump,
          orderbump_pack2in1: comprouPack2in1
        }

        console.log(`Aluno novo. Criando registro:`, insertPayload)

        const { data, error } = await supabaseClient
          .from('alunos')
          .insert(insertPayload)
          .select()

        dataFinal = data
        dbError = error
      }

      if (dbError) {
        console.error("Erro ao salvar aluno no banco:", dbError)
        return new Response(JSON.stringify({ error: "Erro ao salvar no banco de dados.", details: dbError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      console.log(`Aluno ${email} cadastrado/atualizado na tabela pública com sucesso!`, dataFinal)

      // O link de acesso à área de membros é direto
      const siteUrl = "https://drenagemlinfatica.hyzencompra.shop/area-de-membros/"

      // Determinar assunto e template do e-mail de acordo com a compra
      let subject = "Seu acesso à Área de Membros está liberado! 🎓"
      let emailHtml = ""
      const planoFinal = planoIdentificado ?? (alunoExistente?.plano ?? 'Completo')
      
      const finalComOrderbump = comprouOrderbump || (alunoExistente?.orderbump ?? false)
      const finalComPack2in1 = comprouPack2in1 || (alunoExistente?.orderbump_pack2in1 ?? false)

      if (comprouOrderbump || comprouPack2in1) {
        subject = "Seu acesso está liberado + Material adicional incluso! 🎓"
        emailHtml = getEmailHtml(nome || (alunoExistente?.nome ?? ""), siteUrl, planoFinal, finalComOrderbump, finalComPack2in1)
      } else {
        if (alunoExistente) {
          subject = "Seu acesso à Área de Membros foi atualizado! 🎓"
          emailHtml = getEmailHtml(nome || alunoExistente.nome, siteUrl, planoFinal, finalComOrderbump, finalComPack2in1)
        } else {
          emailHtml = getEmailHtml(nome, siteUrl, planoFinal, finalComOrderbump, finalComPack2in1)
        }
      }

      // Disparar o e-mail personalizado usando a API do Resend
      const resendToken = "re_3jsNvZDB_C8nZfu62qGF2NmJ9S1BqsgRN"

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
            subject: subject,
            html: emailHtml
          })
        })

        const resendResult = await resendResponse.json()
        if (!resendResponse.ok) throw new Error(JSON.stringify(resendResult))
        console.log("E-mail enviado com sucesso via Resend:", resendResult)
      } catch (emailErr) {
        console.error("Erro ao enviar e-mail via Resend:", emailErr)
      }

      return new Response(JSON.stringify({ message: "Aluno cadastrado e e-mail disparado!", data: dataFinal }), {
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

function getEmailHtml(name: string, actionLink: string, plano: string, comOrderbump: boolean, comPack2in1: boolean) {
  const orderbumpText = comOrderbump 
    ? `<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 25px; border-radius: 6px;">
         <p style="margin: 0; font-size: 15px; color: #166534; line-height: 1.5; font-weight: 500;">
           <strong>🎉 MATERIAL ADICIONAL LIBERADO!</strong><br>
           O seu bônus adicional <strong>+150 Massagens Emagrecedoras Ilustradas</strong> também já está disponível na sua conta!
         </p>
       </div>`
    : "";

  const pack2in1Text = comPack2in1 
    ? `<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 25px; border-radius: 6px;">
         <p style="margin: 0; font-size: 15px; color: #166534; line-height: 1.5; font-weight: 500;">
           <strong>🎉 MATERIAL ADICIONAL LIBERADO!</strong><br>
           O seu bônus adicional <strong>Pack 2 em 1: Esculpimento + Relaxamento Corporal Prático</strong> também já está disponível na sua conta!
         </p>
       </div>`
    : "";

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
          <p>Parabéns pela aquisição do <strong>Guia +300 Técnicas de Drenagem Linfática Ilustradas (${plano})</strong>! Seu acesso exclusivo à nossa área de membros privada já está liberado.</p>
          
          ${orderbumpText}
          ${pack2in1Text}

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

function getOrderbumpOnlyEmailHtml(name: string, actionLink: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Material Adicional Liberado | Drenagem Linfática Ilustrada</title>
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
          <h2>Seu material adicional foi liberado! 🎉</h2>
          <p>Olá, <strong>${name || 'Aluno(a)'}</strong>,</p>
          <p>Parabéns pela aquisição do bônus adicional <strong>+150 Massagens Emagrecedoras Ilustradas</strong>! Ele já foi liberado e adicionado à sua Área de Membros.</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 25px; border-radius: 6px;">
            <p style="margin: 0; font-size: 15px; color: #166534; line-height: 1.5; font-weight: 500;">
              <strong>🎓 MATERIAL ADICIONAL PRONTO</strong><br>
              Você já pode acessar a Área de Membros e fazer o download do PDF completo das Massagens Emagrecedoras.
            </p>
          </div>

          <!-- Box Informativo de Alerta (Login Sem Senha) -->
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 25px; border-radius: 6px;">
            <p style="margin: 0; font-size: 15px; color: #991b1b; line-height: 1.5; font-weight: 500;">
              <strong>⚠️ LEMBRETE: LOGIN SEM SENHA</strong><br>
              Para fazer o login, informe <strong>APENAS o seu e-mail de compra</strong> na tela de acesso.
            </p>
          </div>

          <p>Clique no botão abaixo para entrar no seu painel:</p>
          
          <div class="button-container">
            <a href="${actionLink}" class="cta-button" style="color: #ffffff;">Acessar Área de Membros</a>
          </div>
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

