// Crisis contacts shown across the site. Checked against the official websites on Oct 16, 2026:
// 988lifeline.org/get-help, 988lifeline.org/deaf-hard-of-hearing-hearing-loss, veteranscrisisline.net,
// crisistextline.org, findahelpline.com, samhsa.gov/find-help/national-helpline.
// RE-VERIFY BEFORE LAUNCH and at least every few months (see README launch checklist).
export const CRISIS_VERIFIED_ON = "October 16, 2026";

export const CRISIS = {
  lifeline: { name: "988 Suicide & Crisis Lifeline", call: "tel:988", text: "sms:988", chat: "https://chat.988lifeline.org/", site: "https://988lifeline.org/" },
  spanish: "Español: llame al 988 y oprima 2, o envíe AYUDA al 988 por texto.",
  veterans: "Veterans, service members and their loved ones: call 988 and press 1, or text 838255.",
  deaf: { text: "Deaf and hard of hearing: 988 is available by videophone (ASL), text and chat.", url: "https://988lifeline.org/deaf-hard-of-hearing-hearing-loss/" },
  textLine: { name: "Crisis Text Line", detail: "Text HOME to 741741", href: "sms:741741?&body=HOME", site: "https://www.crisistextline.org/" },
  samhsa: { name: "SAMHSA National Helpline", detail: "1-800-662-4357 (free, confidential, 24/7, English and Spanish; treatment referral and information)", href: "tel:18006624357", site: "https://www.samhsa.gov/find-help/helplines/national-helpline" },
  findTreatment: "https://findtreatment.gov/",
  international: "https://findahelpline.com/",
};
