import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller('webhooks/slack')
export class ApprovalController {
  private readonly logger = new Logger(ApprovalController.name);

  constructor(private readonly approvalService: ApprovalService) {}

  /**
   * Handle Slack Interactivity URL (Button clicks & Modal submissions)
   * Responds immediately within < 50ms so Slack never hits the 3-second timeout limit.
   */
  @Post('interactions')
  @HttpCode(HttpStatus.OK)
  async handleInteractions(
    @Body() body: any,
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
  ) {
    let payload = body;
    // Slack sends URL-encoded form data where 'payload' is a JSON string
    if (typeof body?.payload === 'string') {
      try {
        payload = JSON.parse(body.payload);
      } catch (e) {
        this.logger.warn('Failed to parse Slack string payload, using raw body');
      }
    }

    const payloadType = payload?.type;
    const user = payload?.user?.id || payload?.user?.username || 'slack_user';

    this.logger.log(`[Slack Webhook] Received ${payloadType} from user @${user}`);

    // Case 1: Button clicks (Block Actions)
    if (payloadType === 'block_actions') {
      const action = payload.actions?.[0];
      const actionId = action?.action_id;
      const approvalId = action?.value;

      if (!approvalId) {
        return { ok: true };
      }

      if (actionId === 'action_approve' || actionId === 'action_approved') {
        // Run decision recording asynchronously in background — do not block the 200 response
        this.approvalService
          .recordDecision(approvalId, 'approved', user)
          .catch((err) => this.logger.error(`Error in async recordDecision (approved): ${err.message}`));

        return { ok: true };
      } else if (actionId === 'action_reject' || actionId === 'action_rejected') {
        // Run decision recording asynchronously in background
        this.approvalService
          .recordDecision(approvalId, 'rejected', user)
          .catch((err) => this.logger.error(`Error in async recordDecision (rejected): ${err.message}`));

        return { ok: true };
      } else if (actionId === 'action_edit' || actionId === 'action_edited') {
        const triggerId = payload.trigger_id;
        if (triggerId) {
          this.approvalService
            .openEditModal(triggerId, approvalId)
            .catch((err) => this.logger.error(`Error in async openEditModal: ${err.message}`));
        }
        return { ok: true };
      }
    }

    // Case 2: Modal submission (View Submission)
    if (payloadType === 'view_submission') {
      const approvalId = payload.view?.private_metadata;
      const values = payload.view?.state?.values;
      const editedContent = values?.edit_input_block?.edited_text_action?.value;

      this.logger.log(`[Slack Modal] view_submission received for approvalId=${approvalId}`);

      if (approvalId && editedContent) {
        this.approvalService
          .recordDecision(approvalId, 'edited', user, editedContent)
          .catch((err) => this.logger.error(`Error in async recordDecision (edited): ${err.message}`));
      }

      return {
        response_action: 'clear',
      };
    }

    return { ok: true };
  }

  /**
   * Handle Slack Events API
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  async handleEvents(@Body() body: any) {
    if (body?.type === 'url_verification') {
      return { challenge: body.challenge };
    }
    return { ok: true };
  }
}
