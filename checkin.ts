// "Where would you like to begin?" check-in. No option is a diagnosis or a score; each one simply
// points to content that may help, plus one small, optional step.
export interface CheckinOption {
  id: string; label: string; journey?: string; articles: string[]; exercises: string[]; community?: string; steps: string[];
}

export const CHECKIN: CheckinOption[] = [
  { id: "overwhelmed", label: "I feel overwhelmed.", journey: "calm-when-overwhelmed", articles: ["understanding-stress", "emotional-regulation-skills"], exercises: ["mindful-pause"],
    steps: ["Take three slow breaths, letting each out a little longer than it came in.", "Write down the one thing that feels most pressing, and nothing else.", "Step outside or to a window for two minutes."] },
  { id: "calm", label: "I need a moment of calm.", journey: "calm-when-overwhelmed", articles: ["mindfulness-basics"], exercises: ["mindful-pause"],
    steps: ["Name five things you can see and four you can hear.", "Relax your shoulders and unclench your jaw.", "Sip a glass of water slowly."] },
  { id: "decision", label: "I am facing a difficult decision.", articles: ["decisions"], exercises: ["decision-step-back"],
    steps: ["Write the decision as a single sentence.", "List what matters most to you about the outcome.", "Ask: what would I advise a friend to do here?"] },
  { id: "thoughts", label: "I want to understand my thoughts.", journey: "untangling-a-thought", articles: ["reframing", "facts-vs-assumptions"], exercises: ["facts-vs-assumptions-sort", "reframe-a-situation"],
    steps: ["Write down one thought that keeps coming back.", "Mark which parts are facts and which are guesses.", "Ask: what else might be true?"] },
  { id: "disconnected", label: "I feel disconnected.", journey: "reconnecting-with-someone", articles: ["understanding-loneliness", "building-healthy-relationships"], exercises: [], community: "everyday-encouragement",
    steps: ["Think of one person you'd like to hear from.", "Send a short, low-pressure message: \"Thinking of you.\"", "Spend a few minutes somewhere with other people around, like a park or cafe."] },
  { id: "routine", label: "I want to build a healthier routine.", articles: ["sleep-routines-that-help", "burnout-signs-and-recovery"], exercises: ["control-map"],
    steps: ["Pick one tiny habit, like a consistent wind-down time.", "Attach it to something you already do every day.", "Notice how it goes for a week, without judging yourself."] },
  { id: "gratitude", label: "I would like to explore gratitude.", articles: ["gratitude"], exercises: ["gratitude-specifics"],
    steps: ["Notice one specific good moment from today, however small.", "Let it be true alongside anything that's hard.", "Consider thanking someone who contributed to it."] },
  { id: "connect", label: "I want to connect with others.", journey: "reconnecting-with-someone", articles: ["building-healthy-relationships", "communication-and-boundaries"], exercises: [], community: "everyday-encouragement",
    steps: ["Read a few community discussions.", "Leave a supportive reply on one post.", "Share a small win or question of your own when you're ready."] },
  { id: "learn", label: "I am ready to learn something new.", articles: ["understanding-your-emotions", "self-compassion-basics", "seeking-professional-help"], exercises: [],
    steps: ["Choose one article that catches your eye.", "Save one idea from it to your journal.", "Try one takeaway this week."] },
];
