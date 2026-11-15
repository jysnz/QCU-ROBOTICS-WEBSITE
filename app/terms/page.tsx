import type { Metadata } from "next";
import { LegalPage, List, Section } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using the QCU Robotics website, member registration and admin area.",
};

export default function TermsPage() {
  return (
    <LegalPage kicker="Legal" title="Terms of Service" updated="November 15, 2026">
      <p>
        These terms apply when you use the QCU Robotics website, the member registration form and the admin area. By using them you agree to these terms.
        If you don&rsquo;t agree, please don&rsquo;t use them.
      </p>

      <Section title="About the website">
        <p>The website is run by QCU Robotics, the robotics team of Quezon City University. It shows our competitions, achievements, matches and team, and lets people register to join.</p>
      </Section>

      <Section title="Registering">
        <List items={[
          "Give true and complete information, and use your own email address.",
          "Registering is a request, not a guarantee. We review every registration and may approve or reject it.",
          "Only submit photos of yourself, and only photos you are happy for us to show on the website once you are approved.",
          "You can ask us to remove your registration at any time. See our Privacy Policy.",
        ]} />
      </Section>

      <Section title="The admin area">
        <p>The admin area is for approved QCU Robotics members only. You sign in with a Google account whose email has been used to register, and an administrator must approve your account before you can use it.</p>
        <List items={[
          "Keep your account to yourself. You are responsible for what is done with it.",
          "Only use the tools you were given access to, and only for QCU Robotics work.",
          "Don't try to reach information or features you aren't allowed to use.",
          "We may remove access at any time, for example if someone leaves the team or misuses the area.",
        ]} />
      </Section>

      <Section title="What you must not do">
        <List items={[
          "Upload anything unlawful, harmful, or that you don't have the right to share.",
          "Try to break, overload or get around the security of the website.",
          "Collect other people's personal information from the website or the admin area.",
          "Pretend to be someone else.",
        ]} />
      </Section>

      <Section title="Content on the website">
        <p>The QCU Robotics name, logo, photos, videos and text on this website belong to QCU Robotics or the people who made them. Please don&rsquo;t copy or reuse them without asking us first. When you send us a photo or file, you allow us to use it on the website and for team activities as described in the Privacy Policy.</p>
      </Section>

      <Section title="No guarantees">
        <p>We try to keep the website accurate and available, but we provide it as it is. Information can be out of date, and the website may be unavailable from time to time. To the extent the law allows, QCU Robotics isn&rsquo;t liable for losses that come from using, or not being able to use, the website.</p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms. The date at the top of this page shows when they last changed. Continuing to use the website after a change means you accept the new terms.</p>
      </Section>

      <Section title="Contact">
        <p>For questions about these terms, contact the QCU Robotics team through the contact and social links on the home page.</p>
      </Section>
    </LegalPage>
  );
}
