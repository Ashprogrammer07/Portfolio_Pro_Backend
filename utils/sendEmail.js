const nodemailer = require('nodemailer');


const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS 
    }
  });
};


const sendContactEmail = async (contact) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `New Contact Form Submission: ${contact.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">Contact Details</h3>
            <p><strong>Name:</strong> ${contact.name}</p>
            <p><strong>Email:</strong> ${contact.email}</p>
            <p><strong>Phone:</strong> ${contact.phone || 'Not provided'}</p>
            <p><strong>Company:</strong> ${contact.company || 'Not provided'}</p>
            <p><strong>Project Type:</strong> ${contact.projectType}</p>
            <p><strong>Priority:</strong> ${contact.priority}</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">Subject</h3>
            <p style="font-size: 16px; font-weight: 500;">${contact.subject}</p>
            
            <h3 style="color: #333;">Message</h3>
            <p style="line-height: 1.6; color: #555;">${contact.message}</p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Submitted on:</strong> ${new Date(contact.createdAt).toLocaleString()}
            </p>
          </div>

          <div style="margin-top: 30px; text-align: center; color: #888; font-size: 12px;">
            <p>This email was automatically generated from your portfolio contact form.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Contact email sent successfully');
  } catch (error) {
    console.error('Error sending contact email:', error);
    throw error;
  }
};


const sendAutoReply = async (contact) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: contact.email,
      subject: 'Thank you for contacting me!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            Thank You for Your Message!
          </h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Hi ${contact.name},
          </p>
          
          <p style="line-height: 1.6; color: #555;">
            Thank you for reaching out to me! I've received your message about 
            "<strong>${contact.subject}</strong>" and I appreciate you taking the time to contact me.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">What's Next?</h3>
            <ul style="color: #555; line-height: 1.6;">
              <li>I'll review your message carefully</li>
              <li>You can expect a response within 24-48 hours</li>
              <li>For urgent matters, feel free to call me directly</li>
            </ul>
          </div>

          <p style="line-height: 1.6; color: #555;">
            In the meantime, feel free to check out my portfolio and recent projects. 
            I look forward to discussing your project with you!
          </p>

          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #4F46E5; margin-top: 0;">Your Message Summary:</h4>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${contact.subject}</p>
            <p style="margin: 5px 0;"><strong>Project Type:</strong> ${contact.projectType}</p>
            <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date(contact.createdAt).toLocaleString()}</p>
          </div>

          <p style="line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>Your Name</strong><br>
            <em>Full Stack Developer</em>
          </p>

          <div style="margin-top: 30px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
            <p>This is an automated response. Please do not reply to this email.</p>
            <p>Visit my portfolio: <a href="${process.env.CLIENT_URL}" style="color: #4F46E5;">Your Portfolio URL</a></p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Auto-reply email sent successfully');
  } catch (error) {
    console.error('Error sending auto-reply email:', error);
 
  }
};


const sendCustomEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log('Custom email sent successfully');
  } catch (error) {
    console.error('Error sending custom email:', error);
    throw error;
  }
};

module.exports = {
  sendContactEmail,
  sendAutoReply,
  sendCustomEmail
};