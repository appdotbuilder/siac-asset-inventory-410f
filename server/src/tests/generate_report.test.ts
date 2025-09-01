import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable } from '../db/schema';
import { type ReportFilter } from '../schema';
import { generateReport } from '../handlers/generate_report';

describe('generateReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test assets for different scenarios
  const createTestAssets = async () => {
    const testAssets = [
      {
        id: 'asset-1',
        name: 'Monitor 1',
        description: 'Dell Monitor',
        category: 'MONITOR' as const,
        condition: 'NEW' as const,
        owner: 'John Doe',
        photo_url: null,
        qr_code: 'QR001',
        is_archived: false
      },
      {
        id: 'asset-2',
        name: 'CPU 1',
        description: 'Dell CPU',
        category: 'CPU' as const,
        condition: 'GOOD' as const,
        owner: 'Jane Smith',
        photo_url: null,
        qr_code: 'QR002',
        is_archived: false
      },
      {
        id: 'asset-3',
        name: 'Chair 1',
        description: 'Office Chair',
        category: 'CHAIR' as const,
        condition: 'UNDER_REPAIR' as const,
        owner: 'John Doe',
        photo_url: null,
        qr_code: 'QR003',
        is_archived: false
      },
      {
        id: 'asset-4',
        name: 'Damaged Monitor',
        description: 'Old Monitor',
        category: 'MONITOR' as const,
        condition: 'DAMAGED' as const,
        owner: null,
        photo_url: null,
        qr_code: 'QR004',
        is_archived: false
      }
    ];

    await db.insert(assetsTable).values(testAssets).execute();
    return testAssets;
  };

  it('should generate PDF report with no filters', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toMatch(/^asset_report_\d{8}T\d{6}\.pdf$/);
    expect(result.filename).toEndWith('.pdf');
  });

  it('should generate XLSX report with no filters', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'XLSX'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toMatch(/^asset_report_\d{8}T\d{6}\.xlsx$/);
    expect(result.filename).toEndWith('.xlsx');
  });

  it('should generate report with condition filter', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      condition: 'NEW'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('NEW');
    expect(result.filename).toEndWith('.pdf');
  });

  it('should generate report with category filter', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'XLSX',
      category: 'MONITOR'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('MONITOR');
    expect(result.filename).toEndWith('.xlsx');
  });

  it('should generate report with owner filter', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      owner: 'John Doe'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('John_Doe');
    expect(result.filename).toEndWith('.pdf');
  });

  it('should generate report with date range filters', async () => {
    await createTestAssets();

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const filters: ReportFilter = {
      format: 'XLSX',
      start_date: startDate,
      end_date: endDate
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('from_2024-01-01');
    expect(result.filename).toContain('to_2024-12-31');
    expect(result.filename).toEndWith('.xlsx');
  });

  it('should generate report with multiple filters', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      condition: 'GOOD',
      category: 'CPU',
      owner: 'Jane Smith',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31')
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('GOOD');
    expect(result.filename).toContain('CPU');
    expect(result.filename).toContain('Jane_Smith');
    expect(result.filename).toContain('from_2024-01-01');
    expect(result.filename).toContain('to_2024-12-31');
    expect(result.filename).toEndWith('.pdf');
  });

  it('should generate report when no assets match filters', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      condition: 'NEW',
      category: 'AC' // No AC assets exist
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('NEW');
    expect(result.filename).toContain('AC');
    expect(result.filename).toEndWith('.pdf');
  });

  it('should generate report with start date filter only', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'XLSX',
      start_date: new Date('2024-01-01')
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('from_2024-01-01');
    expect(result.filename).toEndWith('.xlsx');
  });

  it('should generate report with end date filter only', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      end_date: new Date('2024-12-31')
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toContain('to_2024-12-31');
    expect(result.filename).toEndWith('.pdf');
  });

  it('should handle assets with null owner in filters', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'XLSX',
      owner: null as any // Test null owner explicitly
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toEndWith('.xlsx');
  });

  it('should generate report with all conditions', async () => {
    await createTestAssets();

    const conditions = ['NEW', 'GOOD', 'UNDER_REPAIR', 'DAMAGED'] as const;
    
    for (const condition of conditions) {
      const filters: ReportFilter = {
        format: 'PDF',
        condition
      };

      const result = await generateReport(filters);

      expect(result.url).toContain('/api/reports/download/');
      expect(result.filename).toContain(condition);
      expect(result.filename).toEndWith('.pdf');
    }
  });

  it('should generate report with all categories', async () => {
    const categories = [
      'MONITOR', 'CPU', 'AC', 'CHAIR', 'TABLE', 'DISPENSER',
      'CCTV', 'ROUTER', 'LAN_CABLE', 'OTHER'
    ] as const;

    await createTestAssets();

    for (const category of categories) {
      const filters: ReportFilter = {
        format: 'XLSX',
        category
      };

      const result = await generateReport(filters);

      expect(result.url).toContain('/api/reports/download/');
      expect(result.filename).toContain(category);
      expect(result.filename).toEndWith('.xlsx');
    }
  });

  it('should handle empty database', async () => {
    // Don't create any test assets

    const filters: ReportFilter = {
      format: 'PDF'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.filename).toMatch(/^asset_report_\d{8}T\d{6}\.pdf$/);
    expect(result.filename).toEndWith('.pdf');
  });

  it('should create proper filename encoding for URL', async () => {
    await createTestAssets();

    const filters: ReportFilter = {
      format: 'PDF',
      owner: 'John Doe',
      category: 'MONITOR'
    };

    const result = await generateReport(filters);

    expect(result.url).toContain('/api/reports/download/');
    expect(result.url).toContain(encodeURIComponent(result.filename));
    expect(result.filename).toContain('John_Doe');
    expect(result.filename).toContain('MONITOR');
  });
});