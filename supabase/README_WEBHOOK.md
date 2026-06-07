# Integração de Webhook com PagouAI (Supabase Edge Functions)

Criamos uma **Supabase Edge Function** na pasta `supabase/functions/webhook-pagouai/` que recebe notificações de pagamento do checkout e cadastra automaticamente os compradores como alunos no seu banco de dados.

## 🚀 Como fazer o Deploy no Supabase

1. Abra o terminal na raiz do projeto (`e:\drenagem linfatica`).
2. Certifique-se de ter a CLI do Supabase instalada globalmente. Se não tiver, instale-a via npm:
   ```bash
   npm install -g supabase
   ```
3. Faça login no Supabase via CLI:
   ```bash
   supabase login
   ```
4. Inicialize o projeto vinculando-o ao seu ID do Supabase:
   ```bash
   supabase link --project-ref matmkssuqtodhunmtmvu
   ```
5. Faça o deploy da função:
   ```bash
   supabase functions deploy webhook-pagouai
   ```

---

## 🔗 Configuração do Webhook no Checkout (PagouAI)

Depois de fazer o deploy, a sua URL final do webhook será:
```
https://matmkssuqtodhunmtmvu.supabase.co/functions/v1/webhook-pagouai
```

### Passos no painel da PagouAI:
1. Vá nas configurações do seu produto ou integrações de webhook no painel da **PagouAI**.
2. Adicione uma nova URL de webhook.
3. Cole a URL acima.
4. Selecione os eventos que deseja receber (nossa função está configurada para agir quando o evento for **`pix.paid`** ou **`payment.paid`**).

---

## 📧 Configurando o Envio de E-mails Automático (Supabase Auth)

A função utiliza o próprio serviço de e-mail (SMTP) do Supabase Auth para disparar os e-mails de convite automaticamente após a confirmação da compra.

1. **URL de Redirecionamento**: O link no e-mail levará o aluno diretamente para:
   `https://drenagemlinfatica.netlify.app/area-de-membros/`
2. **Personalizar o Layout do E-mail**:
   * Acesse o painel do Supabase -> **Auth** -> **Email Templates** -> **User Invitation**.
   * Personalize o assunto (ex: `Seu Acesso à Área de Membros Liberado! 🎓`) e o corpo do e-mail da forma que desejar. Use a variável `{{ .ConfirmationURL }}` para o botão de acesso (ela redirecionará automaticamente para o seu domínio na Netlify).

---

## 📝 Comportamento da Função
* Quando o webhook recebe o evento `pix.paid`, ela cadastra o e-mail do aluno na tabela `public.alunos`.
* Dispara a API de convite (`inviteUserByEmail`) do Supabase Auth.
* O Supabase envia o e-mail oficial de convite imediatamente ao comprador contendo o botão de acesso direto.
* O banco possui uma trigger que garante que novos convites também sincronizem o nome do aluno na tabela.
