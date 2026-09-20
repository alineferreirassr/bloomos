"use client";

import { useRef, useState, type FormEvent } from "react";
import { submitMediaKitInquiryAction } from "@/modules/mediaKit/submitMediaKitInquiryAction";
import { recordMediaKitContactStartedAction } from "@/modules/mediaKit/recordMediaKitContactStartedAction";
import type { MediaKitInquiryInput } from "@/types/mediaKit";

const EMPTY_FORM: MediaKitInquiryInput = { name: "", email: "", interest: "", message: "", companyWebsite: "" };

type FormStatus = "idle" | "submitting" | "success" | "error";

const inputClasses =
  "w-full rounded-sm border border-border/70 bg-background px-4 py-3.5 text-base text-text placeholder:text-text-muted/60 transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

interface PublicMediaKitInquiryFormProps {
  slug: string;
}

/**
 * MEDIAKIT-05 — the public "Work With Us" inquiry form. Deliberately a
 * short, elegant form (Name/Email/Interest/Message) rather than a raw CRM
 * intake — `submitMediaKitInquiryAction` does the real work of creating a
 * Lead through the existing BloomOS CRM. `companyWebsite` is a honeypot:
 * real visitors never see or fill it in (visually hidden, `aria-hidden`,
 * excluded from tab order).
 */
export function PublicMediaKitInquiryForm({ slug }: PublicMediaKitInquiryFormProps) {
  const [values, setValues] = useState<MediaKitInquiryInput>(EMPTY_FORM);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  function markStarted() {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void recordMediaKitContactStartedAction(slug);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const result = await submitMediaKitInquiryAction(slug, values);
    if (!result.success) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-sm border border-accent/30 bg-surface px-8 py-14 text-center">
        <p className="font-serif text-2xl text-text">Thank you.</p>
        <p className="mt-3 text-base text-text-muted">Your inquiry has been received — we&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onFocus={markStarted} className="space-y-5 text-left">
      {error ? (
        <p role="alert" className="rounded-sm border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="inquiry_name" className="mb-2 block text-[11px] tracking-[0.12em] text-text-muted uppercase">
            Name
          </label>
          <input
            id="inquiry_name"
            type="text"
            required
            maxLength={160}
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="inquiry_email" className="mb-2 block text-[11px] tracking-[0.12em] text-text-muted uppercase">
            Email
          </label>
          <input
            id="inquiry_email"
            type="email"
            required
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label htmlFor="inquiry_interest" className="mb-2 block text-[11px] tracking-[0.12em] text-text-muted uppercase">
          What are you interested in?
        </label>
        <input
          id="inquiry_interest"
          type="text"
          maxLength={160}
          placeholder="e.g. Wedding photography, an upcoming event"
          value={values.interest ?? ""}
          onChange={(event) => setValues({ ...values, interest: event.target.value })}
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="inquiry_message" className="mb-2 block text-[11px] tracking-[0.12em] text-text-muted uppercase">
          Message
        </label>
        <textarea
          id="inquiry_message"
          required
          rows={5}
          maxLength={2000}
          value={values.message}
          onChange={(event) => setValues({ ...values, message: event.target.value })}
          className={inputClasses}
        />
      </div>

      {/* Honeypot — invisible to a real visitor, never part of the tab order. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="inquiry_company_website">Company Website</label>
        <input
          id="inquiry_company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.companyWebsite}
          onChange={(event) => setValues({ ...values, companyWebsite: event.target.value })}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center rounded-sm border border-accent bg-accent px-8 py-4 font-serif text-base font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? "Sending…" : "Send Inquiry"}
      </button>
    </form>
  );
}
