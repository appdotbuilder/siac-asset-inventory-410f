import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable } from '../db/schema';
import { type AIRecommendation } from '../schema';
import { eq, desc } from 'drizzle-orm';

const GEMINI_API_KEY = 'AIzaSyD9NSNND9Xwr7a_PRJP2ubziI2xmkIRiCI';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export async function getAIRecommendations(asset_id: string): Promise<AIRecommendation> {
  try {
    // Fetch asset data with related information
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    const assetData = asset[0];

    // Fetch related complaints
    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.asset_id, asset_id))
      .orderBy(desc(complaintsTable.created_at))
      .limit(10)
      .execute();

    // Fetch asset history
    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, asset_id))
      .orderBy(desc(assetHistoryTable.changed_at))
      .limit(20)
      .execute();

    // Fetch maintenance schedules
    const maintenanceSchedules = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.asset_id, asset_id))
      .orderBy(desc(maintenanceSchedulesTable.created_at))
      .limit(10)
      .execute();

    // Prepare context for AI
    const assetAge = Math.floor((Date.now() - assetData.created_at.getTime()) / (1000 * 60 * 60 * 24)); // days
    const totalComplaints = complaints.length;
    const urgentComplaints = complaints.filter(c => c.status === 'URGENT').length;
    const completedMaintenance = maintenanceSchedules.filter(m => m.is_completed).length;
    const pendingMaintenance = maintenanceSchedules.filter(m => !m.is_completed).length;
    
    const recentConditionChanges = history.filter(h => h.field_name === 'condition').slice(0, 3);

    const prompt = `As an asset management expert, analyze this asset and provide recommendations:

Asset Details:
- Name: ${assetData.name}
- Category: ${assetData.category}
- Current Condition: ${assetData.condition}
- Age: ${assetAge} days
- Owner: ${assetData.owner || 'Unassigned'}
- Description: ${assetData.description || 'No description'}

Usage Statistics:
- Total Complaints: ${totalComplaints}
- Urgent Complaints: ${urgentComplaints}
- Completed Maintenance: ${completedMaintenance}
- Pending Maintenance: ${pendingMaintenance}

Recent Condition Changes: ${recentConditionChanges.length > 0 
  ? recentConditionChanges.map(h => `${h.old_value} → ${h.new_value} (${h.changed_at.toLocaleDateString()})`).join(', ')
  : 'None'}

Recent Complaints: ${complaints.slice(0, 3).map(c => `${c.status}: ${c.description.substring(0, 100)}`).join('; ')}

Please provide exactly three assessments in JSON format:
{
  "usability_assessment": "Brief assessment of current usability and operational status",
  "maintenance_prediction": "Prediction of maintenance needs with timeline",
  "replacement_recommendation": "Replacement recommendation with rationale and timeline"
}

Keep each assessment concise (1-2 sentences) and actionable.`;

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GeminiResponse;
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const aiText = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from AI response
    let aiRecommendations: AIRecommendation;
    try {
      // Extract JSON from the response (AI might include extra text)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiRecommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      // Fallback: create recommendations based on asset data
      console.error('Failed to parse AI response:', parseError);
      aiRecommendations = generateFallbackRecommendations(assetData, totalComplaints, urgentComplaints, assetAge);
    }

    // Validate the response has all required fields
    if (!aiRecommendations.usability_assessment || 
        !aiRecommendations.maintenance_prediction || 
        !aiRecommendations.replacement_recommendation) {
      throw new Error('Incomplete AI recommendations');
    }

    return aiRecommendations;

  } catch (error) {
    console.error('AI recommendations failed:', error);
    
    // Fallback: try to get basic asset info for fallback recommendations
    try {
      const asset = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, asset_id))
        .execute();
      
      if (asset.length > 0) {
        const assetAge = Math.floor((Date.now() - asset[0].created_at.getTime()) / (1000 * 60 * 60 * 24));
        return generateFallbackRecommendations(asset[0], 0, 0, assetAge);
      }
    } catch (fallbackError) {
      console.error('Fallback recommendations failed:', fallbackError);
    }
    
    throw error;
  }
}

function generateFallbackRecommendations(
  asset: any, 
  totalComplaints: number, 
  urgentComplaints: number, 
  assetAge: number
): AIRecommendation {
  const conditionMap = {
    'NEW': 'Excellent',
    'GOOD': 'Good', 
    'UNDER_REPAIR': 'Currently impaired',
    'DAMAGED': 'Poor'
  };

  const usabilityStatus = conditionMap[asset.condition as keyof typeof conditionMap];
  const hasIssues = urgentComplaints > 0 || asset.condition === 'DAMAGED';
  
  return {
    usability_assessment: `${usabilityStatus} operational status. ${hasIssues ? 'Requires immediate attention due to reported issues.' : 'Suitable for continued use.'}`,
    maintenance_prediction: assetAge > 365 
      ? 'Annual maintenance review recommended due to asset age.'
      : totalComplaints > 2 
        ? 'Preventive maintenance recommended within 30 days due to complaint frequency.'
        : 'Standard maintenance schedule sufficient.',
    replacement_recommendation: asset.condition === 'DAMAGED'
      ? 'Consider replacement due to damaged condition.'
      : assetAge > 1825 // 5 years
        ? 'Evaluate for replacement due to age (5+ years).'
        : 'No immediate replacement needed based on current condition and age.'
  };
}