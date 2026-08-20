import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const sampleRequests = [
  {
    text: 'Draft an announcement welcoming our new VP of Engineering to the global technology organization',
    decision: 'approved',
    user: 'sarah_hr',
  },
  {
    text: 'Research recent trends in enterprise AI adoption and summarize the top 3 findings',
    decision: 'approved',
    user: 'marcus_vp_ops',
  },
  {
    text: 'Schedule a 30-minute kickoff call with the DataSync team next Wednesday afternoon',
    decision: 'approved',
    user: 'alex_lead',
  },
  {
    text: 'Draft a partnership outreach email to DataSync Systems proposing a joint enterprise AI webinar',
    decision: 'edited',
    editedContent: 'Subject: Strategic Joint AI Webinar – OpsAgent & DataSync Systems\n\nDear DataSync Team,\n\nWe would love to co-host an executive webinar on Multi-Agent Operational Workflows with pgvector RAG memory.\n\nWe provide 24/7 dedicated engineering labs and full joint promotion.\n\nWarm regards,\nOps Partnerships',
    user: 'alex_lead',
  },
  {
    text: 'Research the latest updates on PostgreSQL pgvector indexing performance and HNSW vs IVFFlat algorithms',
    decision: 'approved',
    user: 'david_infra',
  },
  {
    text: 'Schedule a 45-minute Q3 sprint planning session with the frontend and backend core teams tomorrow at 10 AM',
    decision: 'approved',
    user: 'elena_pm',
  },
  {
    text: 'Draft a formal decline letter for an unsolicited vendor pitch regarding offshore database consulting',
    decision: 'approved',
    user: 'marcus_vp_ops',
  },
  {
    text: 'Research top enterprise security frameworks for autonomous AI agents and tool calling sandboxes',
    decision: 'approved',
    user: 'david_infra',
  },
  {
    text: 'Draft an urgent incident postmortem announcement explaining the 4-minute cache warmup latency spike',
    decision: 'edited',
    editedContent: 'Subject: Incident Update: Resolved Cache Warmup Latency Spike\n\nTeam,\n\nAt 04:12 UTC, a transient cache warmup delay caused minor API throttling for 4 minutes. Zero data loss occurred.\n\nMitigation: Pre-warming triggers are now automated across all cluster nodes.\n\nBest regards,\nPlatform Engineering',
    user: 'david_infra',
  },
  {
    text: 'Schedule an executive debrief on cloud compute cost reduction strategies with the Director of Finance on Friday at 2 PM',
    decision: 'pending',
    user: 'sarah_hr',
  },
];

async function seed() {
  console.log(`🌱 Seeding OpsAgent live audit feed at ${BACKEND_URL}...`);

  for (let i = 0; i < sampleRequests.length; i++) {
    const item = sampleRequests[i];
    try {
      console.log(`[${i + 1}/${sampleRequests.length}] Ingesting: "${item.text.slice(0, 50)}..."`);
      const res = await axios.post(`${BACKEND_URL}/requests`, { text: item.text });
      const { approvalId, requestId } = res.data;

      if (item.decision !== 'pending' && approvalId) {
        // Submit simulated human decision
        if (item.decision === 'edited') {
          await axios.post(`${BACKEND_URL}/webhooks/slack/interactions`, {
            payload: JSON.stringify({
              type: 'view_submission',
              user: { id: item.user, username: item.user },
              view: {
                private_metadata: approvalId,
                state: {
                  values: {
                    edit_input_block: {
                      edited_text_action: { value: item.editedContent },
                    },
                  },
                },
              },
            }),
          });
        } else {
          await axios.post(`${BACKEND_URL}/webhooks/slack/interactions`, {
            payload: JSON.stringify({
              type: 'block_actions',
              user: { id: item.user, username: item.user },
              actions: [
                {
                  action_id: `action_${item.decision}`,
                  value: approvalId,
                },
              ],
            }),
          });
        }
        console.log(`   ↳ Recorded decision: ${item.decision.toUpperCase()} by @${item.user}`);
      }
      // Small pause between items
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      console.warn(`   ⚠️ Warning seeding item ${i + 1}: ${err.message}`);
    }
  }

  console.log('✅ Seeding completed! The audit dashboard is populated.');
}

seed();
