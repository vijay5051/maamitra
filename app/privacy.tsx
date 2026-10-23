import React from 'react';
import { LegalPage, P, LI, H2, B, A, OPERATOR_NAME, OPERATOR_PLACE, SUPPORT_EMAIL, LEGAL_UPDATED } from '../components/legal/LegalPage';

export default function PrivacyScreen() {
  return (
    <LegalPage title="Privacy Policy" meta={`Last updated: ${LEGAL_UPDATED}`}>
      <P>
        MaaMitra ("we", "us") is operated by <B>{OPERATOR_NAME}</B> (sole proprietor), {OPERATOR_PLACE}. This policy
        explains what personal data we collect when you use the MaaMitra app and website maamitra.co.in, how we use
        it, and your rights under India's Digital Personal Data Protection Act, 2023 (DPDP Act) and other applicable laws.
      </P>
      <P>
        MaaMitra is a <B>parenting information and support companion, not a medical service</B>. See our <A href="/terms">Terms</A> for details.
      </P>

      <H2>1. Data we collect</H2>
      <LI><B>Account data:</B> name, email, phone number, profile photo, and a password if you use one (stored only in hashed form).</LI>
      <LI><B>Family data you choose to add:</B> pregnancy due date, your children's names, dates of birth, growth, vaccines, teeth, foods, allergies and milestones.</LI>
      <LI><B>Chat and content data:</B> questions and photos you send to the AI companion, and posts, comments and reactions in the community.</LI>
      <LI><B>Payment data:</B> if you buy a paid plan, your plan, its status and renewal date, the amount paid, and the order or transaction ID. Card, UPI and bank details are collected by Google Play or Razorpay, never by us.</LI>
      <LI><B>Device and usage data:</B> device type, OS, app version, crash logs, approximate region, and in-app events that help us improve MaaMitra.</LI>
      <LI><B>Cookies and local storage:</B> used on the website to keep you signed in and remember preferences.</LI>
      <P>We do not knowingly collect data directly from children. MaaMitra is for parents and caregivers aged 18 and over.</P>

      <H2>2. How we use your data</H2>
      <LI>To run and personalise MaaMitra, for example tailoring content to your child's age.</LI>
      <LI>To answer your questions through the AI companion (see section 4).</LI>
      <LI>To keep you signed in, send notifications you have turned on, and reply to support requests.</LI>
      <LI>To process paid plans: confirm payments, unlock plan features, handle renewals, cancellations and refunds, and keep tax records.</LI>
      <LI>To keep the community safe by moderating posts and comments.</LI>
      <LI>To detect fraud, abuse and breaches of our Terms, and to meet legal obligations.</LI>
      <P>
        We rely on your <B>consent</B> (for your account, notifications and optional features) and on <B>legitimate
        uses</B> allowed by the DPDP Act (security, fraud prevention, running the service and legal compliance).
      </P>

      <H2>3. Who we share data with</H2>
      <P>We do not sell your personal data, and MaaMitra shows no ads. We share limited data only with:</P>
      <LI><B>Service providers that run MaaMitra:</B> Google Firebase and Google Cloud (sign-in, database, storage, hosting, notifications), Cloudflare (secure connection to the AI service), and our AI model providers (to generate answers).</LI>
      <LI><B>Payment providers:</B> Google Play (purchases in the Android app) and Razorpay (purchases on the website), and any subscription-management service we use to track plan status. They process payments under their own privacy policies.</LI>
      <LI><B>Authorities</B> where the law requires it.</LI>
      <LI><B>A successor</B> if MaaMitra is merged, acquired or restructured, with notice to you.</LI>

      <H2>4. AI processing</H2>
      <P>
        When you chat with the AI companion, your message and relevant details about your family may be sent to our
        AI model provider to generate an answer. Providers are contractually barred from training their general models
        on your data. Your chat history is stored in your account so you can see it later.
      </P>

      <H2>5. Storage and transfer</H2>
      <P>
        Data is stored on Google Cloud, mainly in the <B>asia-south1 (Mumbai)</B> region. Some processing, such as AI
        answers and payment processing, may happen outside India, with safeguards permitted under the DPDP Act.
      </P>

      <H2>6. How long we keep data</H2>
      <P>
        We keep your data while your account is active. When you delete your account, we remove your personal data
        within 30 days, except records we must keep by law, such as payment and tax records (kept as long as tax law requires) or
        records needed to investigate fraud.
      </P>

      <H2>7. Your rights under the DPDP Act</H2>
      <P>
        You can access, correct and erase your data, withdraw consent, and nominate someone to exercise these rights if
        you die or become unable to. You can do most of this in the app (Profile → Settings) or by writing to <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A>.
      </P>

      <H2>8. Security</H2>
      <P>
        We use encryption in transit (TLS), encryption at rest through our cloud provider, Firebase App Check and
        role-based access controls. No system is 100% secure, so please keep your login details safe.
      </P>

      <H2>9. Children's data</H2>
      <P>
        Data you enter about your child is treated as sensitive. As their legal guardian, you control it and can
        delete it at any time.
      </P>

      <H2>10. Changes to this policy</H2>
      <P>We will update this policy when our practices change, and tell you about material changes in the app or by email at least 7 days before they take effect.</P>

      <H2>11. Grievance Officer (DPDP Act 2023)</H2>
      <P><B>Name:</B> {OPERATOR_NAME}</P>
      <P><B>Email:</B> <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A></P>
      <P><B>Location:</B> {OPERATOR_PLACE}</P>
      <P>We respond to grievances within 30 days.</P>
    </LegalPage>
  );
}
