import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { MemoryService } from '../memory/memory.service';
import { ApprovalRecord, ApprovalStatus } from './entities/approval.entity';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);
  private readonly approvals: Map<string, ApprovalRecord> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create an approval row and post interactive Block Kit card to Slack
   */
  async postForApproval(
    requestId: string,
    draftContent: string,
    requestText: string,
    metadata: Record<string, any> = {},
  ): Promise<ApprovalRecord> {
    const approvalId = uuidv4();
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    const channel = this.configService.get<string>('SLACK_CHANNEL_ID') || 'C0BRGNNF0F3';

    const approval: ApprovalRecord = {
      id: approvalId,
      requestId,
      requestText,
      draftContent,
      slackChannel: channel,
      status: 'pending',
      editedContent: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date().toISOString(),
      metadata,
    };

    const blocks = this.buildInitialBlockKit(approval);

    if (token) {
      try {
        const response = await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel,
            text: `Approval required for task: "${requestText.slice(0, 60)}..."`,
            blocks,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.data.ok) {
          approval.slackMessageTs = response.data.ts;
          this.logger.log(
            `[Slack HITL] Posted Block Kit card for Approval [${approvalId}], Slack TS: ${response.data.ts}`,
          );
        } else {
          this.logger.warn(`Slack API error: ${response.data.error}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to post Slack approval message: ${err.message}`);
      }
    } else {
      this.logger.log(`[Slack HITL Simulated] Bot token not provided. Approval [${approvalId}] stored locally.`);
    }

    this.approvals.set(approvalId, approval);
    return approval;
  }

  /**
   * Update approval status, sync back to Slack message via chat.update, and persist into RAG Memory
   */
  async recordDecision(
    approvalId: string,
    status: ApprovalStatus,
    decidedBy: string,
    editedContent?: string | null,
  ): Promise<ApprovalRecord | null> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      this.logger.warn(`Approval record [${approvalId}] not found`);
      return null;
    }

    approval.status = status;
    approval.decidedBy = decidedBy;
    approval.decidedAt = new Date().toISOString();
    if (editedContent !== undefined) {
      approval.editedContent = editedContent;
    }

    this.approvals.set(approvalId, approval);
    this.logger.log(
      `[Decision Finalized] Approval [${approvalId}] -> ${status.toUpperCase()} by user ${decidedBy}`,
    );

    // 1. Update the Slack message to reflect the finalized decision
    await this.updateSlackMessage(approval);

    // 2. Persist decision into RAG Memory (vector store)
    if (status !== 'pending') {
      await this.memoryService.store({
        requestId: approval.requestId,
        requestText: approval.requestText,
        agentUsed: approval.metadata?.agentName || 'drafting',
        output: approval.draftContent,
        decision: status,
        editedContent: approval.editedContent,
      });
    }

    // 3. Update Audit Log and emit live SSE event to dashboard
    if (status !== 'pending') {
      await this.auditService.updateDecision(
        approval.requestId,
        status,
        decidedBy,
        approval.editedContent,
      );
    }

    return approval;
  }

  /**
   * Update the original Slack message using chat.update (replaces buttons with final decision status)
   */
  async updateSlackMessage(approval: ApprovalRecord): Promise<boolean> {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    if (!token || !approval.slackMessageTs || !approval.slackChannel) {
      return false;
    }

    const updatedBlocks = this.buildResolvedBlockKit(approval);

    try {
      const response = await axios.post(
        'https://slack.com/api/chat.update',
        {
          channel: approval.slackChannel,
          ts: approval.slackMessageTs,
          text: `Decision recorded: ${approval.status.toUpperCase()} for task "${approval.requestText.slice(0, 40)}..."`,
          blocks: updatedBlocks,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.ok) {
        this.logger.log(`[Slack Updated] Message ${approval.slackMessageTs} updated with decision ${approval.status}`);
        return true;
      } else {
        this.logger.warn(`Failed to update Slack message: ${response.data.error}`);
        return false;
      }
    } catch (err: any) {
      this.logger.error(`Slack chat.update call failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Open a Slack Modal (views.open) when the user clicks "Edit Draft"
   */
  async openEditModal(triggerId: string, approvalId: string): Promise<boolean> {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    const approval = this.approvals.get(approvalId);
    if (!token || !approval) {
      return false;
    }

    const currentText = approval.editedContent || approval.draftContent;

    const modalView = {
      type: 'modal',
      callback_id: `edit_modal_${approvalId}`,
      private_metadata: approvalId,
      title: {
        type: 'plain_text',
        text: 'Edit Deliverable Draft',
        emoji: true,
      },
      submit: {
        type: 'plain_text',
        text: 'Save & Approve',
        emoji: true,
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Original Task:*\n>${approval.requestText}`,
          },
        },
        {
          type: 'input',
          block_id: 'edit_input_block',
          element: {
            type: 'plain_text_input',
            action_id: 'edited_text_action',
            multiline: true,
            initial_value: currentText,
          },
          label: {
            type: 'plain_text',
            text: 'Refine or customize the draft below:',
            emoji: true,
          },
        },
      ],
    };

    try {
      const response = await axios.post(
        'https://slack.com/api/views.open',
        {
          trigger_id: triggerId,
          view: modalView,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return Boolean(response.data.ok);
    } catch (err: any) {
      this.logger.error(`Failed to open Slack edit modal: ${err.message}`);
      return false;
    }
  }

  /**
   * Verify Slack request signature (HMAC-SHA256)
   */
  verifySlackSignature(signature: string, timestamp: string, rawBody: string): boolean {
    const signingSecret = this.configService.get<string>('SLACK_SIGNING_SECRET');
    if (!signingSecret) return true;

    const time = parseInt(timestamp, 10);
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (time < fiveMinutesAgo) {
      this.logger.warn('Slack request timestamp expired');
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    const mySignature = `v0=${hmac.update(sigBasestring).digest('hex')}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }

  getApproval(id: string): ApprovalRecord | undefined {
    return this.approvals.get(id);
  }

  getApprovalByRequestId(requestId: string): ApprovalRecord | undefined {
    for (const record of this.approvals.values()) {
      if (record.requestId === requestId) return record;
    }
    return undefined;
  }

  getAllApprovals(): ApprovalRecord[] {
    return Array.from(this.approvals.values());
  }

  private buildInitialBlockKit(approval: ApprovalRecord) {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🤖 OpsAgent Review: ${approval.metadata?.agentName?.toUpperCase() || 'DRAFTING'} Task`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Approval ID:*\n\`${approval.id.slice(0, 8)}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Model Tier:*\n\`${approval.metadata?.tier || 'cheap'}\` ($${(approval.metadata?.cost || 0.000015).toFixed(5)})`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Original Request:*\n> ${approval.requestText}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Generated Draft / Deliverable:*\n\`\`\`${approval.draftContent}\`\`\``,
        },
      },
      {
        type: 'actions',
        block_id: `approval_actions_${approval.id}`,
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Approve & Send',
              emoji: true,
            },
            style: 'primary',
            value: approval.id,
            action_id: 'action_approve',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✏️ Edit Draft',
              emoji: true,
            },
            value: approval.id,
            action_id: 'action_edit',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❌ Reject',
              emoji: true,
            },
            style: 'danger',
            value: approval.id,
            action_id: 'action_reject',
          },
        ],
      },
    ];
  }

  private buildResolvedBlockKit(approval: ApprovalRecord) {
    let statusEmoji = '✅';
    let statusText = 'Approved as-is';
    if (approval.status === 'edited') {
      statusEmoji = '✏️';
      statusText = 'Edited & Approved';
    } else if (approval.status === 'rejected') {
      statusEmoji = '❌';
      statusText = 'Rejected';
    }

    const finalContent = approval.editedContent || approval.draftContent;

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} OpsAgent Task ${statusText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n*${approval.status.toUpperCase()}*`,
          },
          {
            type: 'mrkdwn',
            text: `*Decided By:*\n<@${approval.decidedBy || 'slack_user'}>`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Original Request:*\n> ${approval.requestText}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Final Deliverable:*\n\`\`\`${finalContent}\`\`\``,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🧠 Decision embedded to OpsAgent pgvector RAG memory at ${new Date(approval.decidedAt || Date.now()).toLocaleTimeString()}`,
          },
        ],
      },
    ];
  }
}
