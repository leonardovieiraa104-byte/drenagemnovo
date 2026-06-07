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

      // Realiza o upsert (insere novo ou atualiza se o e-mail já existir)
      const { data, error } = await supabaseClient
        .from('alunos')
        .upsert(
          { email: email, nome: nome },
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

      // Convidar o usuário através do Supabase Auth (isso faz o próprio Supabase disparar o e-mail de acesso)
      const siteUrl = "https://drenagemlinfatica.netlify.app/area-de-membros/"
      
      const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: siteUrl,
        data: { name: nome }
      })

      if (inviteError) {
        console.error("Erro ao disparar e-mail de convite pelo Supabase Auth:", inviteError)
        // Não falhamos a requisição pois o aluno já foi inserido na tabela pública de acesso
      } else {
        console.log(`E-mail de convite enviado via Supabase para: ${email}`, inviteData)
      }

      return new Response(JSON.stringify({ message: "Aluno cadastrado e e-mail disparado!", data }), {
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
