import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { LEGAL_UPDATED, PrivacyText } from "../components/LegalText";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How QCU Robotics collects, uses and protects the information you give us when you register or sign in.",
};

export default function PrivacyPage() {
  return (
    <LegalPage kicker="Legal" title="Privacy Policy" updated={LEGAL_UPDATED}>
      <PrivacyText />
    </LegalPage>
  );
}
