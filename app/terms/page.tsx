import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { LEGAL_UPDATED, TermsText } from "../components/LegalText";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using the QCU Robotics website, member registration and admin area.",
};

export default function TermsPage() {
  return (
    <LegalPage kicker="Legal" title="Terms of Service" updated={LEGAL_UPDATED}>
      <TermsText />
    </LegalPage>
  );
}
