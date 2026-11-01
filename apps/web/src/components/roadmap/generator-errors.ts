import { ApiError } from "@/lib/types";

/** What the Build page says for each generator error code from the API. */
export function generatorErrorMessage(error: unknown): {
  title: string;
  body: string;
  showOfficial: boolean;
} {
  const code = error instanceof ApiError ? error.code : "SERVER_ERROR";
  const details = error instanceof ApiError ? (error.details as { limit?: number } | null) : null;
  switch (code) {
    case "NON_TECH_GOAL":
      return {
        title: "That goal is outside what we cover",
        body: "PadhLo builds tech learning roadmaps. Try a programming, data or AI goal.",
        showOfficial: false,
      };
    case "RATE_LIMITED":
      return details?.limit
        ? {
            title: "Daily limit reached",
            body: `You've used today's ${details.limit} roadmaps. Try again tomorrow, or start an official roadmap.`,
            showOfficial: true,
          }
        : {
            title: "Too many tries today",
            body: "You've made a lot of attempts today. Try again tomorrow, or start an official roadmap.",
            showOfficial: true,
          };
    case "GENERATOR_UNAVAILABLE":
      return {
        title: "Roadmap generation is paused",
        body: "Our generator is resting for now. Our official roadmaps are a great place to start.",
        showOfficial: true,
      };
    case "GENERATION_FAILED":
      return {
        title: "We couldn't build a good roadmap",
        body: "Try rewording your goal: say what you want to build or which role you're aiming for.",
        showOfficial: false,
      };
    case "CONFLICT":
      return {
        title: "Already working on it",
        body: "We're still building your previous roadmap. Give it a few seconds.",
        showOfficial: false,
      };
    case "NOT_AUTHENTICATED":
      return {
        title: "Please log in",
        body: "Log in to build your roadmap. It's saved to your account.",
        showOfficial: false,
      };
    case "VALIDATION_ERROR":
      return {
        title: "Please check your goal",
        body: error instanceof Error ? error.message : "Something in the form needs fixing.",
        showOfficial: false,
      };
    default:
      return {
        title: "Something went wrong",
        body: "We couldn't build your roadmap this time. Please try again in a moment.",
        showOfficial: false,
      };
  }
}
