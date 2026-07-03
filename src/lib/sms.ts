/**
 * SMS provider abstraction.
 *
 * Configure a provider via environment variables to send real messages.
 * Supported out of the box: MSG91, Fast2SMS, Twilio.
 * If no provider is configured:
 *   - in development, the message is logged to the server console and the OTP
 *     is returned so you can test the full flow without a gateway;
 *   - in production, sending fails loudly (so you don't silently skip OTPs).
 *
 * Env:
 *   SMS_PROVIDER = "msg91" | "fast2sms" | "twilio"
 *   MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID (flow) — for MSG91
 *   FAST2SMS_API_KEY — for Fast2SMS
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM — for Twilio
 */

export interface SmsResult {
  delivered: boolean;
  provider: string;
  error?: string;
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  const mobile10 = to.replace(/\D/g, "").slice(-10);

  try {
    if (provider === "msg91" && process.env.MSG91_AUTH_KEY) {
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: process.env.MSG91_AUTH_KEY,
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          sender: process.env.MSG91_SENDER_ID,
          short_url: "0",
          recipients: [{ mobiles: `91${mobile10}`, OTP: extractCode(message) }],
        }),
      });
      return { delivered: res.ok, provider: "msg91", error: res.ok ? undefined : `HTTP ${res.status}` };
    }

    if (provider === "fast2sms" && process.env.FAST2SMS_API_KEY) {
      const params = new URLSearchParams({
        route: "otp",
        variables_values: extractCode(message),
        numbers: mobile10,
      });
      const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, {
        headers: { authorization: process.env.FAST2SMS_API_KEY },
      });
      return { delivered: res.ok, provider: "fast2sms", error: res.ok ? undefined : `HTTP ${res.status}` };
    }

    if (
      provider === "twilio" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    ) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const body = new URLSearchParams({
        To: `+91${mobile10}`,
        From: process.env.TWILIO_FROM,
        Body: message,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      return { delivered: res.ok, provider: "twilio", error: res.ok ? undefined : `HTTP ${res.status}` };
    }

    // No provider configured
    if (process.env.NODE_ENV !== "production") {
      console.log(`[sms:dev] → ${mobile10}: ${message}`);
      return { delivered: false, provider: "dev" };
    }
    return { delivered: false, provider: "none", error: "No SMS provider configured" };
  } catch (e) {
    console.error("[sms] send failed", e);
    return { delivered: false, provider, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** True in dev with no provider — lets the API expose the code for local testing. */
export function isDevSms(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.SMS_PROVIDER;
}

function extractCode(message: string): string {
  const m = message.match(/\d{4,8}/);
  return m ? m[0] : message;
}
