import { Briefcase, Clapperboard, Cpu, GraduationCap, Globe, HeartPulse, Landmark, Trophy } from "lucide-react";

// Ids must match the backend's /news/categories ids.
export const CATEGORIES = [
  { id: "sports", label: "Sports", icon: Trophy, blurb: "Scores, matches and tournaments" },
  { id: "politics", label: "Politics", icon: Landmark, blurb: "Government, elections and policy" },
  { id: "education", label: "Education", icon: GraduationCap, blurb: "Schools, universities and exams" },
  { id: "technology", label: "Technology", icon: Cpu, blurb: "Gadgets, software and AI" },
  { id: "business", label: "Business", icon: Briefcase, blurb: "Markets, companies and economy" },
  { id: "entertainment", label: "Entertainment", icon: Clapperboard, blurb: "Movies, music and culture" },
  { id: "health", label: "Health", icon: HeartPulse, blurb: "Medicine, wellness and research" },
  { id: "world", label: "World", icon: Globe, blurb: "Top stories from around the globe" },
];

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const SUGGESTED_QUESTIONS = [
  "Explain this news in simple English.",
  "What are the important points?",
  "Why did this event happen?",
  "What could happen next?",
  "Explain the background of this news.",
];
