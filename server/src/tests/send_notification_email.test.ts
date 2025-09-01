import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { sendNotificationEmail, type EmailNotification } from '../handlers/send_notification_email';

// Test data for different notification types
const complaintNotification: EmailNotification = {
  to: ['admin@company.com', 'maintenance@company.com'],
  subject: 'New Complaint: Monitor Not Working',
  body: 'A new complaint has been submitted for Asset ID: MON-001\nDescription: Monitor is not turning on despite power connection.',
  type: 'complaint'
};

const maintenanceNotification: EmailNotification = {
  to: ['technician@company.com'],
  subject: 'Maintenance Reminder: AC Unit Service',
  body: 'Scheduled maintenance for AC Unit (AC-005) is due tomorrow.\nPlease ensure all necessary tools and parts are available.',
  type: 'maintenance'
};

const statusChangeNotification: EmailNotification = {
  to: ['manager@company.com', 'owner@company.com'],
  subject: 'Status Update: Router Repair Completed',
  body: 'Asset ROUTER-003 status has been changed from UNDER_REPAIR to GOOD.\nRepair completed successfully.',
  type: 'status_change'
};

describe('sendNotificationEmail', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should send complaint notification successfully', async () => {
    const result = await sendNotificationEmail(complaintNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(typeof result.messageId).toBe('string');
    expect(result.messageId).toMatch(/<.*@asset-management\.com>/);
    expect(result.error).toBeUndefined();
  });

  it('should send maintenance notification successfully', async () => {
    const result = await sendNotificationEmail(maintenanceNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should send status change notification successfully', async () => {
    const result = await sendNotificationEmail(statusChangeNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should handle multiple recipients correctly', async () => {
    const multiRecipientNotification: EmailNotification = {
      to: ['user1@company.com', 'user2@company.com', 'user3@company.com'],
      subject: 'System Update',
      body: 'The asset management system will undergo maintenance tonight.',
      type: 'status_change'
    };

    const result = await sendNotificationEmail(multiRecipientNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should fail when no recipients are provided', async () => {
    const invalidNotification: EmailNotification = {
      to: [],
      subject: 'Test Subject',
      body: 'Test body',
      type: 'complaint'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No recipients specified');
    expect(result.messageId).toBeUndefined();
  });

  it('should fail when subject is empty', async () => {
    const invalidNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: '',
      body: 'Test body',
      type: 'maintenance'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Subject cannot be empty');
  });

  it('should fail when subject is only whitespace', async () => {
    const invalidNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: '   ',
      body: 'Test body',
      type: 'maintenance'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Subject cannot be empty');
  });

  it('should fail when body is empty', async () => {
    const invalidNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Test Subject',
      body: '',
      type: 'status_change'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email body cannot be empty');
  });

  it('should fail when body is only whitespace', async () => {
    const invalidNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Test Subject',
      body: '   \n\t  ',
      type: 'status_change'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email body cannot be empty');
  });

  it('should fail with invalid notification type', async () => {
    const invalidNotification = {
      to: ['user@company.com'],
      subject: 'Test Subject',
      body: 'Test body',
      type: 'invalid_type' as any
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid notification type');
  });

  it('should fail when email addresses are invalid', async () => {
    const invalidNotification: EmailNotification = {
      to: ['invalid-email', 'another-invalid'],
      subject: 'Test Subject',
      body: 'Test body',
      type: 'complaint'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid email address/);
  });

  it('should fail when some email addresses are invalid', async () => {
    const invalidNotification: EmailNotification = {
      to: ['valid@company.com', 'invalid-email'],
      subject: 'Test Subject',
      body: 'Test body',
      type: 'complaint'
    };

    const result = await sendNotificationEmail(invalidNotification);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid email address: invalid-email/);
  });

  it('should handle long email bodies correctly', async () => {
    const longBody = 'This is a very long email body. '.repeat(100);
    const longBodyNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Long Email Test',
      body: longBody,
      type: 'maintenance'
    };

    const result = await sendNotificationEmail(longBodyNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should handle email body with line breaks correctly', async () => {
    const bodyWithLineBreaks = 'Line 1\nLine 2\nLine 3\n\nLine 5';
    const notification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Line Break Test',
      body: bodyWithLineBreaks,
      type: 'status_change'
    };

    const result = await sendNotificationEmail(notification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should generate unique message IDs for each email', async () => {
    const notification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Unique ID Test',
      body: 'Testing unique message ID generation',
      type: 'complaint'
    };

    const result1 = await sendNotificationEmail(notification);
    const result2 = await sendNotificationEmail(notification);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.messageId).toBeDefined();
    expect(result2.messageId).toBeDefined();
    expect(result1.messageId).not.toBe(result2.messageId);
  });

  it('should handle special characters in subject and body', async () => {
    const specialCharNotification: EmailNotification = {
      to: ['user@company.com'],
      subject: 'Special Chars: !@#$%^&*()_+{}[]|;:,.<>?',
      body: 'Body with special characters: áéíóú ñÑ çÇ 中文 العربية русский',
      type: 'maintenance'
    };

    const result = await sendNotificationEmail(specialCharNotification);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});