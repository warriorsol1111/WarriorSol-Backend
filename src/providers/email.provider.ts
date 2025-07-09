import { transporter } from "../config/nodemailer.config.js";

export async function sendEmail(
  email: string,
  subject: string,
  template: string
) {
  try {
    // Define the email options
    const mailOptions = {
      from: "DoNotReply@WarriorSolcom",
      to: email,
      subject: subject,
      html: template,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (e) {
    console.error("Email sending error:", e);
    throw e;
  }
}
