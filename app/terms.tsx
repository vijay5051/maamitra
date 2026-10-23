import React from 'react';
import { LegalPage, P, LI, H2, B, A, OPERATOR_NAME, OPERATOR_PLACE, SUPPORT_EMAIL, LEGAL_UPDATED } from '../components/legal/LegalPage';

export default function TermsScreen() {
  return (
    <LegalPage title="Terms & Conditions" meta={`Last updated: ${LEGAL_UPDATED}`}>
      <P>
        These Terms are an agreement between you and <B>{OPERATOR_NAME}</B> (sole proprietor, {OPERATOR_PLACE}),
        who operates MaaMitra ("we", "us"). They cover the MaaMitra app and the website maamitra.co.in.
        By creating an account or using MaaMitra, you agree to them. If you don't agree, please don't use MaaMitra.
      </P>

      <H2>1. Who can use MaaMitra</H2>
      <P>You must be 18 or older and able to enter a contract under Indian law. MaaMitra is for personal, non-commercial use by parents and caregivers.</P>

      <H2>2. Your account</H2>
      <P>You are responsible for everything that happens under your account. Keep your login safe, and tell us at once if you think someone else has used it.</P>

      <H2>3. Not medical advice</H2>
      <P>
        MaaMitra is an <B>information and support tool, not a substitute for professional medical advice,
        diagnosis or treatment</B>. The AI companion, articles, recipes, home remedies and community posts are
        not medical advice. For any medical concern, including emergencies, symptoms in pregnancy or your
        child's health, always consult a qualified doctor. In an emergency call <B>108 / 102</B> or go to the nearest hospital.
      </P>

      <H2>4. Acceptable use</H2>
      <P>You agree not to:</P>
      <LI>post content that is unlawful, abusive, hateful, sexually explicit, or infringes anyone's rights;</LI>
      <LI>impersonate another person or misrepresent your relationship with a child;</LI>
      <LI>probe, scan or test the security of MaaMitra;</LI>
      <LI>scrape MaaMitra, automate access to it, or resell it;</LI>
      <LI>use MaaMitra to provide medical services to others.</LI>
      <P>We may remove content and suspend or close accounts that break these Terms.</P>

      <H2>5. Your content</H2>
      <P>
        You keep ownership of what you post. You give us a worldwide, non-exclusive, royalty-free licence to
        host, display and process it only to run MaaMitra, including moderating it and showing it to the audience you chose.
      </P>

      <H2>6. AI answers</H2>
      <P>
        AI answers are generated automatically and may be wrong or incomplete. Check anything important with a
        professional before acting on it. You are responsible for how you use AI answers.
      </P>

      <H2>7. Free and paid plans</H2>
      <P>
        MaaMitra has a Free plan and paid plans (Plus and Family). What each plan includes and its price are
        listed on our <A href="/pricing">Pricing page</A>. Until paid plans launch, every feature is free to use.
      </P>
      <LI><B>Prices</B> are in Indian rupees and include applicable taxes such as GST.</LI>
      <LI><B>Billing:</B> in the Android app, paid plans are bought and billed through Google Play. On the website, they are billed through our payment partner Razorpay.</LI>
      <LI><B>Auto-renewal:</B> monthly and yearly plans renew automatically at the end of each period and you are charged the then-current price, unless you cancel before the renewal date.</LI>
      <LI><B>Free trials:</B> if you start a free trial, you will be charged when it ends unless you cancel before then.</LI>
      <LI><B>Cancelling</B> stops future renewals. You keep your paid features until the end of the period you have paid for. See our <A href="/refund">Refund & Cancellation Policy</A>.</LI>
      <LI><B>Price changes:</B> we will tell you at least 30 days before a price change, and it applies from your next renewal.</LI>
      <LI><B>Offers:</B> promotional prices (for example, Founding Mothers) apply only as described in the offer. A locked price lasts while your subscription stays active without a break.</LI>
      <LI><B>Daily limits and fair use:</B> plans include daily limits, such as the number of AI questions. "Unlimited" means normal personal use; we may limit automated, shared or abusive use.</LI>
      <LI><B>Feature changes:</B> we may add, change or remove features. If we remove a major paid feature during your paid period, you may ask for a pro-rata refund for the unused time.</LI>

      <H2>8. Intellectual property</H2>
      <P>
        MaaMitra, its name, logos, content and software belong to {OPERATOR_NAME} and are protected by law.
        Nothing in these Terms transfers that intellectual property to you.
      </P>

      <H2>9. Closing your account</H2>
      <P>
        You can delete your account at any time from Profile → Settings. Deleting your account does not cancel a
        Google Play subscription; cancel it in the Play Store first. We may suspend or close accounts for breaking
        these Terms, for security risks or for legal reasons.
      </P>

      <H2>10. Disclaimers</H2>
      <P>MaaMitra is provided "as is" and "as available", without warranties of any kind, to the fullest extent permitted by law.</P>

      <H2>11. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, {OPERATOR_NAME} is not liable for indirect, incidental or
        consequential damages. Our total liability for any claim is limited to ₹1,000 or the amount you paid us
        in the 12 months before the claim, whichever is higher.
      </P>

      <H2>12. Indemnity</H2>
      <P>You agree to indemnify {OPERATOR_NAME} against claims arising from your misuse of MaaMitra or breach of these Terms.</P>

      <H2>13. Governing law and disputes</H2>
      <P>These Terms are governed by the laws of India. Courts at Jaipur, Rajasthan have exclusive jurisdiction, subject to your rights under consumer protection law.</P>

      <H2>14. Changes to these Terms</H2>
      <P>We may update these Terms. We will tell you about material changes in the app or by email at least 7 days before they take effect.</P>

      <H2>15. Contact</H2>
      <P>
        <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A> · {OPERATOR_NAME}, {OPERATOR_PLACE}. More ways to reach us are on our <A href="/contact">Contact page</A>.
      </P>
    </LegalPage>
  );
}
