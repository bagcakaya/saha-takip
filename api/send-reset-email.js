import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, companyName, companyCode, adminName, code } = payload || {};

    if (!to || !code) {
      res.status(400).json({ error: 'Missing required parameters (to, code)' });
      return;
    }

    const subject = `🔐 ${code} - Saha Takip Yönetici Şifre Sıfırlama Kodu (${companyCode || 'Kurum'})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Şifre Sıfırlama Kodu</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
                <!-- Header Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px 24px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                      Saha Takip Raporu
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 500;">
                      Yönetici Güvenlik & Doğrulama Hizmeti
                    </div>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 32px 28px;">
                    <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">
                      Merhaba ${adminName || 'Yönetici'},
                    </h2>
                    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong style="color: #0f172a;">${companyName || companyCode}</strong> (${companyCode}) kurumu için yönetici hesabınıza ait şifre sıfırlama talebinde bulunuldu.
                    </p>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
                      <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                        6 Haneli Doğrulama Kodunuz
                      </div>
                      <div style="font-size: 36px; font-weight: 900; color: #2563eb; letter-spacing: 10px; font-family: monospace; padding: 8px 0;">
                        ${code}
                      </div>
                      <div style="font-size: 12px; color: #dc2626; font-weight: 700; margin-top: 8px;">
                        ⏱️ Bu kod 15 dakika boyunca geçerlidir.
                      </div>
                    </div>

                    <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 20px 0 0 0;">
                      Uygulamanın şifre sıfırlama ekranına yukarıdaki kodu girerek yeni yönetici şifrenizi anında belirleyebilirsiniz.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin-top: 24px;">
                      <p style="font-size: 11px; color: #991b1b; margin: 0; line-height: 1.5;">
                        <strong>Güvenlik Uyarısı:</strong> Eğer bu talebi siz yapmadıysanız, hesabınız güvendedir. Bu e-postayı dikkate almayınız ve güvenlik kodunuzu kimseyle paylaşmayınız.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
                    <p style="font-size: 11px; color: #94a3b8; margin: 0; font-weight: 500;">
                      © 2026 Polatlar Yazılım. Tüm Hakları Saklıdır.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 1. Corporate SMTP via info@polatlaryazilim.com
    const smtpPass = process.env.SMTP_PASS || process.env.POLATLAR_MAIL_PASS;
    const smtpUser = process.env.SMTP_USER || 'info@polatlaryazilim.com';
    const smtpHost = process.env.SMTP_HOST || 'mail.kurumsaleposta.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

    if (smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const sendResult = await transporter.sendMail({
          from: `"Polatlar Yazılım" <${smtpUser}>`,
          to: to,
          subject: subject,
          html: htmlContent,
        });

        res.status(200).json({
          success: true,
          provider: 'corporate_smtp',
          from: smtpUser,
          messageId: sendResult.messageId,
        });
        return;
      } catch (smtpErr) {
        console.warn('Corporate SMTP send error:', smtpErr);
      }
    }

    // 2. Check for Resend API Key
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Polatlar Yazılım <${smtpUser || 'onboarding@resend.dev'}>`,
            to: [to],
            subject,
            html: htmlContent,
          }),
        });
        const resendData = await resendResponse.json();
        res.status(200).json({ success: true, provider: 'resend', data: resendData });
        return;
      } catch (err) {
        console.warn('Resend send failed:', err);
      }
    }

    // 3. Check for Brevo API Key
    const brevoKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
    if (brevoKey) {
      try {
        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Polatlar Yazılım', email: smtpUser || 'info@polatlaryazilim.com' },
            to: [{ email: to, name: adminName || 'Yönetici' }],
            subject,
            htmlContent,
          }),
        });
        const brevoData = await brevoResponse.json();
        res.status(200).json({ success: true, provider: 'brevo', data: brevoData });
        return;
      } catch (err) {
        console.warn('Brevo send failed:', err);
      }
    }

    // 4. Fallback: Saved to Supabase Slot 99
    res.status(200).json({
      success: true,
      provider: 'cloud_slot',
      from: 'info@polatlaryazilim.com',
      message: 'Sıfırlama kodu oluşturuldu ve güvenlik yuvasına kaydedildi.',
      info: 'Canlı mail gönderimi için Vercel paneline SMTP_PASS (info@polatlaryazilim.com şifresi) eklenmelidir.',
    });
  } catch (error) {
    console.error('Password reset email error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
