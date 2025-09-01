export interface EmailNotification {
    to: string[];
    subject: string;
    body: string;
    type: 'complaint' | 'maintenance' | 'status_change';
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// Mock SMTP configuration for demonstration
// In production, this would be configured with actual email service credentials
interface SMTPConfig {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
        user: string;
        pass: string;
    };
}

const defaultSMTPConfig: SMTPConfig = {
    host: process.env['SMTP_HOST'] || 'localhost',
    port: parseInt(process.env['SMTP_PORT'] || '587'),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: process.env['SMTP_USER'] && process.env['SMTP_PASS'] ? {
        user: process.env['SMTP_USER'],
        pass: process.env['SMTP_PASS']
    } : undefined
};

// Email templates for different notification types
const getEmailTemplate = (notification: EmailNotification): { subject: string; html: string } => {
    const baseStyles = `
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }
            .alert { padding: 15px; margin: 10px 0; border-radius: 4px; }
            .alert-complaint { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
            .alert-maintenance { background-color: #fff3cd; border-color: #ffeaa7; color: #856404; }
            .alert-status { background-color: #cce5ff; border-color: #b3d7ff; color: #004085; }
        </style>
    `;

    let alertClass = 'alert';
    let icon = '📧';
    
    switch (notification.type) {
        case 'complaint':
            alertClass += ' alert-complaint';
            icon = '⚠️';
            break;
        case 'maintenance':
            alertClass += ' alert-maintenance';
            icon = '🔧';
            break;
        case 'status_change':
            alertClass += ' alert-status';
            icon = '📊';
            break;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${notification.subject}</title>
            ${baseStyles}
        </head>
        <body>
            <div class="header">
                <h2>${icon} Asset Management System</h2>
            </div>
            <div class="content">
                <div class="${alertClass}">
                    <h3>${notification.subject}</h3>
                    <div>${notification.body.replace(/\n/g, '<br>')}</div>
                </div>
                <p><em>This is an automated notification from the Asset Management System.</em></p>
            </div>
            <div class="footer">
                <p>Asset Management System - Do not reply to this email</p>
            </div>
        </body>
        </html>
    `;

    return {
        subject: `[Asset Management] ${notification.subject}`,
        html
    };
};

// Mock email sending function
// In production, this would use a real email service like nodemailer, SendGrid, etc.
const mockSendEmail = async (
    to: string[], 
    subject: string, 
    html: string, 
    config: SMTPConfig
): Promise<EmailResult> => {
    try {
        // Simulate email validation
        for (const email of to) {
            if (!email || !email.includes('@')) {
                throw new Error(`Invalid email address: ${email}`);
            }
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock successful sending with generated message ID
        const messageId = `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@asset-management.com>`;
        
        // In development/test mode, log the email details
        if (process.env.NODE_ENV !== 'production') {
            console.log('📧 Mock Email Sent:', {
                to,
                subject,
                messageId,
                bodyLength: html.length
            });
        }

        return {
            success: true,
            messageId
        };
    } catch (error) {
        console.error('Email sending failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};

export const sendNotificationEmail = async (notification: EmailNotification): Promise<EmailResult> => {
    try {
        // Validate input
        if (!notification.to || notification.to.length === 0) {
            return {
                success: false,
                error: 'No recipients specified'
            };
        }

        if (!notification.subject || notification.subject.trim() === '') {
            return {
                success: false,
                error: 'Subject cannot be empty'
            };
        }

        if (!notification.body || notification.body.trim() === '') {
            return {
                success: false,
                error: 'Email body cannot be empty'
            };
        }

        if (!['complaint', 'maintenance', 'status_change'].includes(notification.type)) {
            return {
                success: false,
                error: 'Invalid notification type'
            };
        }

        // Generate email template
        const emailTemplate = getEmailTemplate(notification);

        // Send email using mock service
        const result = await mockSendEmail(
            notification.to,
            emailTemplate.subject,
            emailTemplate.html,
            defaultSMTPConfig
        );

        return result;
    } catch (error) {
        console.error('Notification email failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};