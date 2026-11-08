import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { Section } from "@/components/ui/section";
import { contact } from "@/data/marketing/home";
import { siteConfig } from "@/lib/config/site";

/** Contact details render only when configured — no placeholder mailto: or tel: links. */
function ConfiguredContactDetails() {
  const { email, phone, address } = siteConfig.contact;
  if (!email && !phone && !address) return null;
  return (
    <ul className="mt-8 space-y-3 text-sm text-ink-soft">
      {email ? (
        <li className="flex items-center gap-2.5">
          <Mail className="size-4 text-accent-700" aria-hidden="true" />
          <a href={`mailto:${email}`} className="font-medium text-ink underline-offset-2 hover:underline">
            {email}
          </a>
        </li>
      ) : null}
      {phone ? (
        <li className="flex items-center gap-2.5">
          <Phone className="size-4 text-accent-700" aria-hidden="true" />
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            {phone}
          </a>
        </li>
      ) : null}
      {address ? (
        <li className="flex items-center gap-2.5">
          <MapPin className="size-4 text-accent-700" aria-hidden="true" />
          <span>{address}</span>
        </li>
      ) : null}
    </ul>
  );
}

export function ContactSection() {
  return (
    <Section id="kontakt" eyebrow={contact.eyebrow} title={contact.title} tone="surface">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <p className="text-base leading-relaxed text-ink-soft sm:text-lg">{contact.intro}</p>
          <ConfiguredContactDetails />
        </div>
        <div className="rounded-2xl border border-line bg-canvas p-5 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
