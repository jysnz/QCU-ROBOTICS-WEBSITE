import { List, Section } from "./LegalPage";

/* The wording of the Privacy Policy and the Terms of Service, in one place. The public pages (/privacy, /terms) and the
   Settings page of the admin area both show these, so they can never disagree. Change the date when you change the text. */
export const LEGAL_UPDATED = "November 15, 2026";

export function PrivacyText() {
  return (
    <>
      <p>
        This website belongs to QCU Robotics, the robotics team of Quezon City University. This policy explains what information we collect when you
        use the website, the member registration form or the admin area, what we do with it, and the choices you have. We handle personal data in line
        with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <Section title="What we collect">
        <p><strong className="font-semibold text-white">If you only browse the website,</strong> we don&rsquo;t ask you for anything. Like most sites, our hosting provider records basic technical information such as your IP address and browser type to keep the site working and secure.</p>
        <p><strong className="font-semibold text-white">If you register as a member, media team member or player,</strong> you give us:</p>
        <List items={[
          "your name, gender and birthday",
          "your email address and student ID",
          "your program, year level and section",
          "your hobbies, likes and a short description about yourself",
          "one or more photos of yourself",
          "the role you are signing up for",
        ]} />
        <p><strong className="font-semibold text-white">If you sign in to the admin area,</strong> you do it with a Google account. Google shares your name, email address and profile picture with us. We keep them so we can show who you are inside the admin area and decide whether you may use it.</p>
      </Section>

      <Section title="How we use it">
        <List items={[
          "To review your registration and add you to the team roster.",
          "To show your name and photo on this website once your registration is approved. Nothing else from your registration is shown publicly.",
          "To contact you about team activities, competitions and tasks you are assigned.",
          "To decide who may manage the website, and to keep the website and its records secure.",
        ]} />
        <p>We don&rsquo;t sell your information and we don&rsquo;t use it for advertising.</p>
      </Section>

      <Section title="Who can see it">
        <p>Your registration details (email, birthday, student ID, program, section, hobbies and the rest) are private. Only approved QCU Robotics administrators can see them. Only your name and photo can appear on the public website, and only after approval.</p>
        <p>We use trusted services to run the website. They process data for us and aren&rsquo;t allowed to use it for their own purposes:</p>
        <List items={[
          "Supabase, for the database and sign-in",
          "Google, for the Continue with Google sign-in",
          "Cloudflare, for storing uploaded photos and files and for the Turnstile check that tells people from bots",
          "Vercel, for hosting the website",
        ]} />
        <p>We may also share information if the law requires it.</p>
      </Section>

      <Section title="How long we keep it">
        <p>We keep your information for as long as you are part of the team, or until you ask us to remove it. A registration that is rejected is moved to an archive and deleted permanently, together with its photos, after 30 days.</p>
      </Section>

      <Section title="Cookies and local storage">
        <p>The admin area stores a sign-in session in your browser so you stay signed in. The website may also save small preferences, such as whether you prefer a grid or a list. We don&rsquo;t use advertising or tracking cookies.</p>
      </Section>

      <Section title="Your rights">
        <p>You can ask us to show you the information we hold about you, correct it, or delete it, and you can object to how we use it. To do any of these, contact the QCU Robotics team through the contact and social links on the home page, and tell us the email you registered with. We will reply as soon as we can.</p>
      </Section>

      <Section title="Security">
        <p>Photos and private details are stored in access-controlled storage and are visible only to approved administrators. No online service is perfectly secure, but we take reasonable steps to protect your information.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If we change this policy we will update the date at the top of this page.</p>
      </Section>
    </>
  );
}

export function TermsText() {
  return (
    <>
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
    </>
  );
}
