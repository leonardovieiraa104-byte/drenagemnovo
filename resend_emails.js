const fs = require('fs');
const path = require('path');

const RESEND_TOKEN = "re_3jsNvZDB_C8nZfu62qGF2NmJ9S1BqsgRN";
const SENDER = "Drenagem Linfática <acesso@drenagemlinfatica.hyzencompra.shop>";
const NEW_DOMAIN = "https://drenagemlinfatica.hyzencompra.shop/area-de-membros/";

// Path of the exported database file
const DATA_FILE_PATH = "C:/Users/Leonardo/.gemini/antigravity-ide/brain/f6c62d5a-3376-401a-b7b7-e15adb7e997b/.system_generated/steps/241/output.txt";

function getEmailHtml(name, actionLink, plano, comOrderbump, comPack2in1) {
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
</html>`;
}

// Function to send a single email via Resend API
async function sendEmail(email, name, plano, comOrderbump, comPack2in1) {
  const subject = (comOrderbump || comPack2in1)
    ? "Seu acesso está liberado + Material adicional incluso! 🎓"
    : "Seu acesso à Área de Membros está liberado! 🎓";

  const emailHtml = getEmailHtml(name, NEW_DOMAIN, plano, comOrderbump, comPack2in1);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: SENDER,
      to: [email],
      subject: subject,
      html: emailHtml
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const isSendMode = args.includes("--send");
  const isTestMode = args.includes("--test");

  if (!isSendMode && !isTestMode) {
    console.log("Por favor, use um dos argumentos abaixo para executar:");
    console.log("  node resend_emails.js --test  -> Envia apenas 1 email de teste para você.");
    console.log("  node resend_emails.js --send  -> Envia para todos os 593 alunos em lote.");
    process.exit(0);
  }

  // Load and parse the database output
  console.log("Carregando arquivo de dados...");
  const rawData = fs.readFileSync(DATA_FILE_PATH, "utf8");
  
  const obj = JSON.parse(rawData);
  const text = obj.result;
  
  // Find JSON block between untrusted-data boundaries
  const match = text.match(/<untrusted-data-[0-9a-f-]{36}>\n([\s\S]*?)\n<\/untrusted-data-[0-9a-f-]{36}>/);
  if (!match) {
    console.error("Erro: Bloco de dados JSON não encontrado no arquivo.");
    process.exit(1);
  }

  const students = JSON.parse(match[1]);
  console.log(`Sucesso: ${students.length} alunos carregados.`);

  if (isTestMode) {
    console.log("\n--- MODO TESTE ---");
    // Find Leonardo's email or use first student for testing
    const testStudent = students.find(s => s.email.includes("leonardo")) || students[0];
    console.log(`Enviando e-mail de teste para: ${testStudent.nome} <${testStudent.email}>...`);
    try {
      // For safety in test mode, we send it to your email
      const res = await sendEmail("leonardovieira68478@gmail.com", "Leonardo Vieira (Teste)", testStudent.plano, testStudent.orderbump, testStudent.orderbump_pack2in1);
      console.log("E-mail de teste enviado com sucesso!", res);
    } catch (err) {
      console.error("Erro ao enviar e-mail de teste:", err.message);
    }
    process.exit(0);
  }

  if (isSendMode) {
    console.log("\n--- MODO DISPARO EM LOTE ---");
    console.log(`Iniciando envio para ${students.length} alunos. Delay de 300ms por e-mail...`);
    
    let successCount = 0;
    let failureCount = 0;
    const logFile = path.join(__dirname, "resend_results.log");
    fs.writeFileSync(logFile, `=== Início do Envio: ${new Date().toISOString()} ===\n`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const percent = ((i + 1) / students.length * 100).toFixed(1);
      
      console.log(`[${i + 1}/${students.length}] (${percent}%) Enviando para: ${student.email}...`);
      
      try {
        await sendEmail(student.email, student.nome, student.plano, student.orderbump, student.orderbump_pack2in1);
        successCount++;
        fs.appendFileSync(logFile, `[OK] ${student.email} - ${student.nome}\n`);
      } catch (err) {
        failureCount++;
        console.error(`Erro ao enviar para ${student.email}:`, err.message);
        fs.appendFileSync(logFile, `[ERRO] ${student.email} - ${student.nome}: ${err.message}\n`);
      }

      // 300ms delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log("\n=== FIM DO DISPARO ===");
    console.log(`Enviados com sucesso: ${successCount}`);
    console.log(`Erros: ${failureCount}`);
    console.log(`Log detalhado escrito em: ${logFile}`);
  }
}

main().catch(err => {
  console.error("Erro crítico na execução:", err);
});
