*Authored by Steven Chock, with Claude Sonnet 5.5 (Anthropic) as co-author.*

# ai-interviewer: roadmap

Working draft, organized from a brain dump. See `SPEC.md` for the vision and initial specifications.

## 1. Real-time verbal interviewer (first)

The real-time verbal interviewer was always planned to be the first deliverable. It ships in two stages that differ in length and purpose.

### Stage 1: 10-15 minute interview

- Purpose: basic screening.
- Acclimatize the user to the format.
- Get the user's pacing down.

### Stage 2: 45-60 minute interview

- Purpose: simulate a real technical interview.
- Get the user to experience fatigue and variance, which a short session can't produce.
- Builds on Stage 1, which is expanded to this length.

## 2. Ideas to place (not yet scheduled)

None of these has a phase yet. The first two came up while building the verbal interviewer.

- **Whiteboard question:** a way to demonstrate real-time knowledge.
- **Proctored real-time code review challenge:** the user reviews code under proctoring, in real time.
- **System debugging/triage:** found through research; more and more companies are doing proof of skill in real time. Two known formats:
  - Find a reproducible bug in code using only logs.
  - Get dropped into an open source project with a reproducible bug.
  - Cost: these would take more effort to manage, since every scenario would need to be curated.
  - Linked to Pandemonium Panda (section 5): its LLM-generated buggy code could supply debugging scenarios on the fly, which would avoid the curation cost.
- **Practical scoping & API design interview:** turned up in further research.
  - Why: beyond its own conclusion, it's about maintainability and communication, all circling around empathy for fellow developers. The core question is whether people can understand and use your API with minimal friction.
  - Source: <https://www.hellointerview.com/learn/system-design/core-concepts/api-design>
- **Behavioral "de-escalation" / cross-functional interview:** included as practice only for now. It is highly subjective, so no feedback or scoring until further research shows whether feedback is feasible.
  - Research question: can feedback be based on observable behaviors (acknowledging the other person's concern, restating their position, asking clarifying questions, proposing a next step, not escalating the tone)?
  - Risk: the LLM playing the difficult counterpart may be inconsistent or too gentle.

## 3. Practice modes that actually build skill

- **System Design Buzzword Overhaul.** The user must avoid brand names (like Kafka and Redis) and terms that are ambiguously defined even within the industry (like Service Oriented Architecture and Microservices). Instead, they articulate what the thing does, or state their own interpretation of it.

## 4. Practice modes included for newer engineers

Included because newer engineers who want to practice with this software need them, even though the author does not approve of the practice itself (the author is vehemently opposed to the first two).

- **LeetCode-style coding problems.**
- **Software design pattern training.**
- **OOP and Domain Modelling trivia.** Anyone who got an A in Computer Science will have memorized these.
- **Trivia-style language/framework quizzing.** Anyone who did the "Get Started" for a framework will have memorized the lingo.

Why the author opposes LeetCode and design patterns: in an interview, you can memorize Computer Science solutions and design patterns, having never used them at all. Even worse, the people screening with LeetCode and design patterns frequently don't use them in practice either.

Why the author does not approve of OOP and Domain Modelling trivia: candidates can memorize definitions of "encapsulation" or "composition over inheritance" perfectly while still writing unreadable, highly coupled spaghetti code in production.

Why the author does not approve of language/framework trivia: it rewards people who just read the documentation cover to cover to pass a test, over engineers who understand how to build resilient software. Knowing a framework's hidden configurations by heart does not make someone a great problem solver.

## 5. Fun stuff

- **Pandemonium Panda** (a play on Chaos Monkey): an LLM generates broken or buggy code on the fly, and the user must fix it in real time.
  - Related to the proctored code review challenge in section 2: both put the user in front of someone else's flawed code under time pressure. They may share infrastructure.
  - Also linked to system debugging/triage (section 2): the generator could produce reproducible bugs plus logs, instead of hand-curated scenarios.
- **The Creepy Crypt Client** (a play on words for scope creep and the Crypt Keeper): the user designs a system based on a client request. New requirements are then added incrementally, and the user practices redesigning as they arrive.

## 6. Desktop client (later)

The first client runs in an ordinary browser, which gives the feel of a web chat. A desktop version comes later, for the feel of a Zoom or Teams call.

- It must emulate the classic chat setups (headsets, speakers, device selection, echo), so the practice stays as realistic as the browser version.
- The browser version is built so a desktop client can be added without redoing the interviewer.

## Open questions

- Do the whiteboard and code review ideas belong inside the 45-60 minute interview as segments, or are they separate modes?
- Are the LeetCode and design pattern modes part of the verbal interview, or standalone practice?
- Does the 10-15 minute screen have a defined output (score, notes, pacing feedback), or is it purely practice?
