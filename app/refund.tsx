import React from 'react';
import { LegalPage, P, LI, H2, B, A, SUPPORT_EMAIL, LEGAL_UPDATED } from '../components/legal/LegalPage';

export default function RefundScreen() {
  return (
    <LegalPage title="Refund & Cancellation Policy" meta={`Last updated: ${LEGAL_UPDATED}`}>
      <P>
        This policy explains how to cancel a MaaMitra paid plan (Plus or Family) and when you can get a refund. Plan
        prices are on our <A href="/pricing">Pricing page</A>. The Free plan involves no payment.
      </P>

      <H2>1. Cancelling your plan</H2>
      <P>You can cancel any time. Cancelling stops the next renewal; it does not end your plan straight away.</P>
      <LI><B>Bought in the Android app (Google Play):</B> open the Play Store → profile icon → Payments & subscriptions → Subscriptions → MaaMitra → Cancel.</LI>
      <LI><B>Bought on the website (Razorpay):</B> email <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A> from your account email, and we will cancel the renewal within 1 working day.</LI>
      <P>
        After cancelling, you keep your paid features until the end of the period you have paid for, then move to the
        Free plan. Your data stays in your account.
      </P>
      <P>Deleting your MaaMitra account does not cancel a Google Play subscription. Please cancel it in the Play Store first.</P>

      <H2>2. Free trials</H2>
      <P>If you cancel before your free trial ends, you will not be charged. If you don't, the plan starts and the first payment is taken when the trial ends.</P>

      <H2>3. Refunds for website purchases (Razorpay)</H2>
      <LI><B>First payment:</B> if you are not happy, ask for a refund within <B>7 days</B> of your first payment for a plan and we will refund it in full.</LI>
      <LI><B>Renewals:</B> renewal payments are not refundable, because you can cancel at any time before the renewal date.</LI>
      <LI><B>Always refunded in full:</B> a charge taken after you cancelled, a duplicate charge, or a payment where a technical fault on our side stopped you using your paid features.</LI>
      <LI><B>Partial periods:</B> we don't refund the unused part of a month or year when you cancel, except where our Terms say so (for example, if we remove a major paid feature).</LI>

      <H2>4. Refunds for Google Play purchases</H2>
      <P>
        Purchases in the Android app are processed by Google, and Google's refund rules apply. Within 48 hours of
        a purchase you can ask Google directly at play.google.com → Order history → Request a refund. After that,
        email us. We review each request under the same rules as section 3 and ask Google to refund it if eligible.
      </P>

      <H2>5. How refunds are paid</H2>
      <P>
        Approved refunds go back to the original payment method (card, UPI, net banking or wallet). Razorpay refunds
        usually reach you within <B>5–7 working days</B>; your bank may take longer. When a refund is processed, your
        paid features end and your account returns to the Free plan.
      </P>

      <H2>6. How to ask for a refund</H2>
      <P>Email <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A> with:</P>
      <LI>the email or phone number on your MaaMitra account;</LI>
      <LI>the date and amount of the payment;</LI>
      <LI>the order or transaction ID from your receipt, if you have it.</LI>
      <P>We reply within 2 working days.</P>

      <H2>7. Price changes</H2>
      <P>We will tell you at least 30 days before a price change. It applies from your next renewal, and you can cancel before then if you don't want to continue.</P>

      <H2>8. Questions</H2>
      <P>See our <A href="/contact">Contact page</A> or our <A href="/terms">Terms & Conditions</A>.</P>
    </LegalPage>
  );
}
