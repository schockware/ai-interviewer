QUESTIONS = {
  "TEC-01": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to running production infrastructure?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate describes what they like about systems work in general terms and names no concrete occasion that shaped their interest.",
            "focus": "a moment that confirmed their interest",
            "text": "Can you point to one particular moment that shaped your interest in this work?",
            "priority": 1
          },
          {
            "trigger": "mentions_improvement",
            "criteria": "The candidate says they enjoy making systems more reliable, automating manual work or fixing recurring problems.",
            "focus": "the improvement they care about most",
            "text": "Which kind of improvement to a system or process matters most to you?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through a patching or maintenance process you designed or improved for a large fleet of servers.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate explains how they built or changed the patching or maintenance process but not what the result was for the fleet or team.",
            "focus": "what the process achieved",
            "text": "What changed once that process was running?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a specific scripting approach, configuration tool or rollout method used for patching or maintenance.",
            "focus": "why they chose that approach",
            "text": "What made you choose that approach?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a production outage that put you under real pressure and how you led the response.",
        "followups": [
          {
            "trigger": "no_personal_role",
            "criteria": "The candidate describes what the team did during the outage but their own decisions and actions are unclear.",
            "focus": "their own part in the response",
            "text": "What was your own part in that response, specifically?",
            "priority": 1
          },
          {
            "trigger": "mentions_mistake",
            "criteria": "The candidate mentions a cause, a missed signal or an error that contributed to the outage or made it worse.",
            "focus": "what changed after the incident",
            "text": "What changed afterward because of that?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a restore test shows the backups of a critical database are unusable, and an audit starts next week. What would you do?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's plan is ambiguous or contradictory about the order of steps.",
            "focus": "the order of their steps",
            "text": "Could you clarify the order of the steps you would take?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate jumps to fixing or rebuilding without mentioning protecting current data, documenting the problem or informing security or compliance owners.",
            "focus": "checks before changing production",
            "text": "What would you verify or document before you touch that production system?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "How do you keep your infrastructure skills current, especially around cloud services and infrastructure as code?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate talks about learning habits in general terms but names nothing specific they recently learned or applied.",
            "focus": "something recently learned",
            "text": "What is one specific thing you learned recently?",
            "priority": 1
          },
          {
            "trigger": "strong_answer_stretch",
            "criteria": "The candidate gives a specific, complete account of learning cloud or automation skills and applying them with clear results.",
            "focus": "teaching it to on-premises colleagues",
            "text": "How would you teach those skills to a teammate who has only worked with on-premises servers?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "TEC-02": {
    "core": [
      {
        "category": "motivation",
        "text": "What about building back-end services keeps you interested?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks about enjoying back-end work in general but names no particular project or problem.",
            "focus": "a project that shows what they enjoy",
            "text": "Which project best shows the kind of problem you enjoy?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions users, customers or support colleagues as a reason they care about their work.",
            "focus": "how users shape their building",
            "text": "How do the needs of the people using your software change the way you build it?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through a service or feature you owned from planning through production, including the design choices you made.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate describes the design and build but does not say how the feature behaved in production or what it achieved.",
            "focus": "how it performed in production",
            "text": "How did it perform once it was live?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a specific architecture, database technique, queue or design pattern behind their choices.",
            "focus": "trade-offs behind the design",
            "text": "What were the trade-offs of choosing that design?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a disagreement in a code review or design discussion and how you handled it.",
        "followups": [
          {
            "trigger": "no_personal_role",
            "criteria": "The candidate describes the disagreement and its resolution but their own position and actions are unclear.",
            "focus": "their own actions in the disagreement",
            "text": "What did you personally do in that discussion?",
            "priority": 1
          },
          {
            "trigger": "mentions_mistake",
            "criteria": "The candidate admits that their approach, or the other person's, turned out to have a flaw.",
            "focus": "what they learned about feedback",
            "text": "How do you approach giving and receiving technical feedback now?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a release you shipped is causing errors in production and support is flooding you with reports. What would you do first?",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate lists immediate actions but not how they would confirm the problem is truly fixed or what happens after.",
            "focus": "how they confirm it is fixed",
            "text": "Once things are stable, how would you confirm the problem is really fixed?",
            "priority": 1
          },
          {
            "trigger": "mentions_time_pressure",
            "criteria": "The candidate mentions several urgent demands competing at once, such as rollback, diagnosis and communication.",
            "focus": "how they set priorities under pressure",
            "text": "How would you decide what to handle first when several urgent things compete for your attention?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "Where do you want to grow next as an engineer, especially around cloud deployment and production monitoring?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate names a growth area but gives no concrete step they have already taken toward it.",
            "focus": "steps already taken to grow",
            "text": "What have you already done to build that skill?",
            "priority": 1
          },
          {
            "trigger": "mentions_leadership",
            "criteria": "The candidate mentions mentoring, reviewing code for or teaching other engineers as part of their growth.",
            "focus": "how they mentor newer engineers",
            "text": "How do you go about helping a newer engineer build the same skill?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "TEC-03": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to building user interfaces?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate describes enjoying interface work in general terms and names no particular interface they built.",
            "focus": "an interface that shows their interest",
            "text": "Can you describe one interface you built that shows why you enjoy this work?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions shoppers, users or customers and how their needs influence the interface.",
            "focus": "how they learn what users need",
            "text": "How do you learn what the people using your interface actually need?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through how you built or contributed to a set of reusable components, from first idea to adoption by other teams.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate explains building the shared components but not what happened once other teams used them.",
            "focus": "what changed once teams adopted it",
            "text": "What changed for the teams once they started using those components?",
            "priority": 1
          },
          {
            "trigger": "mentions_leadership",
            "criteria": "The candidate mentions persuading, training or supporting other developers to adopt the shared components.",
            "focus": "how they encouraged adoption",
            "text": "How did you encourage other developers to adopt them in their own work?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time you and a designer or back-end engineer disagreed about how a feature should work.",
        "followups": [
          {
            "trigger": "no_personal_role",
            "criteria": "The candidate describes the disagreement in general terms and their own position and actions are unclear.",
            "focus": "their own position and actions",
            "text": "What did you personally do in that disagreement?",
            "priority": 1
          },
          {
            "trigger": "mentions_time_pressure",
            "criteria": "The candidate mentions a deadline or competing priorities that shaped how the disagreement was settled.",
            "focus": "how the pressure shaped the outcome",
            "text": "How did that pressure shape the way the disagreement was settled?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose you are building a long enrollment form and testers report that people using screen readers cannot complete it. How would you approach it?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's plan is ambiguous or contradictory about which problems they would fix first.",
            "focus": "which fixes come first",
            "text": "Could you clarify which fixes you would make first?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate describes fixing the form but does not mention automated tests, assistive technology checks or accessibility standards.",
            "focus": "how they would test the fix",
            "text": "How would you test the fix before release, including with assistive technology?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "How do you keep up with changes in front-end tools and performance practices?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate describes learning habits in general terms but names nothing specific they recently learned or used.",
            "focus": "something recently learned",
            "text": "What is one concrete thing you learned lately?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a framework, library or technique they have adopted or are considering adopting.",
            "focus": "how they judge new tools",
            "text": "How do you decide when a new tool is worth adopting on a team?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "TEC-04": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to analytics work?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate talks about liking data and business questions in general and names no particular question they answered.",
            "focus": "a question they answered",
            "text": "Can you describe one particular business question you answered?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions stakeholders, business teams or customers whose needs shape the analysis they do.",
            "focus": "how they learn what stakeholders need",
            "text": "How do you work out what the people asking for analysis truly need?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through an analysis you did that changed a decision, from the first question to your final recommendation.",
        "followups": [
          {
            "trigger": "no_personal_role",
            "criteria": "The candidate describes a team analysis but it is unclear which parts they did themselves.",
            "focus": "which parts they did themselves",
            "text": "Which parts of that analysis did you do yourself?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a specific method such as cohort analysis, regression or a particular query or modelling approach.",
            "focus": "why they chose that method",
            "text": "Why did you choose that method?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time a senior stakeholder disagreed with what the data was telling them.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate describes the disagreement but not how it ended or what decision was made.",
            "focus": "how the disagreement ended",
            "text": "How did that disagreement end?",
            "priority": 1
          },
          {
            "trigger": "mentions_mistake",
            "criteria": "The candidate mentions a misread of the data, an error in their work or a weakness in how they presented findings.",
            "focus": "what they learned about presenting findings",
            "text": "How do you present findings that people may not want to hear?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a weekly dashboard shows sales dropping sharply, but you suspect a data problem rather than a real change. What would you do?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's approach is ambiguous or contradictory about what they would check first.",
            "focus": "what they would check first",
            "text": "Could you clarify what you would check first?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate would report or act on the drop without validating data sources, pipelines or definitions first.",
            "focus": "validation before reporting",
            "text": "What validation checks would you run before telling anyone the numbers are wrong?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "Which part of analytics, such as experimentation, do you most want to strengthen?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate names a growth area but no concrete thing they have done or studied toward it.",
            "focus": "steps already taken to build the skill",
            "text": "What have you actually done so far to build that skill?",
            "priority": 1
          },
          {
            "trigger": "strong_answer_stretch",
            "criteria": "The candidate gives a specific and thorough account of their experimentation skills and results.",
            "focus": "a harder experiment design",
            "text": "Suppose you had to test a promotion where customers shop both online and in stores. How would you design it?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "TEC-05": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to helping people with their technology problems?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks in general terms about liking to help and names no particular occasion from work, school or elsewhere.",
            "focus": "a time they helped someone with technology",
            "text": "Can you share one moment, from work, school or home, when you helped someone with technology?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions the people they help and how their frustration or needs affect how they work.",
            "focus": "how they put frustrated users at ease",
            "text": "How do you put someone at ease when they are frustrated with a technical problem?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through a technical problem you helped someone fix, at work, at school or at home, from the first report to the end.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate explains the troubleshooting steps but not whether the problem was solved or how the person responded.",
            "focus": "how the problem ended",
            "text": "How did that situation end for the person you helped?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a specific tool, remote support method or troubleshooting technique they used.",
            "focus": "how they used the tool or method",
            "text": "How did you use that tool or method to work out the problem?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time you helped someone who was frustrated with technology, at work, at school or at home.",
        "followups": [
          {
            "trigger": "no_personal_role",
            "criteria": "The candidate describes the situation in general terms and what they personally said or did is unclear.",
            "focus": "what they personally said or did",
            "text": "What did you personally say or do in that situation?",
            "priority": 1
          },
          {
            "trigger": "mentions_time_pressure",
            "criteria": "The candidate mentions other requests waiting or competing demands while they worked on the problem.",
            "focus": "how they handled waiting requests",
            "text": "How did you handle the other requests waiting while you worked on that one?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a user asks you to reset a password for a coworker who is out of office and says it is urgent. What would you do?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's answer is ambiguous or contradictory about what they would actually do and in what order.",
            "focus": "the steps they would take",
            "text": "Could you clarify the order of the steps you would take?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate would reset or share access without verifying identity or getting approval from the account owner or a manager.",
            "focus": "verification before changing the account",
            "text": "What would you check before changing that account?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "What do you want to learn next in IT support?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate names a learning goal but no concrete step they have already taken toward it.",
            "focus": "steps already taken to learn",
            "text": "What have you already done to start learning it?",
            "priority": 1
          },
          {
            "trigger": "mentions_improvement",
            "criteria": "The candidate mentions improving guides, documentation or processes as part of their development.",
            "focus": "using learning to improve the knowledge base",
            "text": "How would you use what you learn to make a knowledge base more useful to colleagues?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "MED-01": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to producing audio stories and conversations?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks in general terms about loving audio and names no episode or project that shows it.",
            "focus": "an episode that captures what they love",
            "text": "Can you describe an episode you worked on that captures what you love about this work?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions listeners, the audience or sponsors and how their needs shape the work.",
            "focus": "how listeners shape their choices",
            "text": "How do you think about what the listener needs when you shape an episode?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through how you take an episode from raw recordings to a finished release, including how you protect quality.",
        "followups": [
          {
            "trigger": "no_measure",
            "criteria": "The candidate describes their production workflow but gives no sense of how many episodes they handled.",
            "focus": "episodes handled per week",
            "text": "Roughly how many episodes did you handle in a typical week?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names specific editing software, a mixing method or a quality checklist.",
            "focus": "how they keep audio consistent",
            "text": "How did that tool or method help keep the audio consistent across episodes?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time freelancers, hosts or guests put a release date at risk and how you managed it.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate describes the scheduling problem and their actions but not whether the episode released and what happened.",
            "focus": "whether the release went out",
            "text": "What happened with the release in the end?",
            "priority": 1
          },
          {
            "trigger": "mentions_time_pressure",
            "criteria": "The candidate mentions a tight release date or competing show deadlines that forced trade-offs.",
            "focus": "what they prioritized to protect the date",
            "text": "How did you decide what to prioritize to protect the release date?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a guest's recording arrives with heavy background noise and the episode must release tomorrow. How would you handle it?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's plan is ambiguous or contradictory about what they would try first.",
            "focus": "what they would try first",
            "text": "Could you clarify what you would try first?",
            "priority": 1
          },
          {
            "trigger": "strong_answer_stretch",
            "criteria": "The candidate gives a complete, practical plan covering repair, communication with the guest and a fallback if the repair fails.",
            "focus": "a harder version with a sponsor message",
            "text": "Suppose the guest cannot re-record and a sponsor message sits in that segment. What would you do differently?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "How do you use listener data to improve your shows?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks about using data in general terms without naming a decision that data actually changed.",
            "focus": "a decision listener data changed",
            "text": "Can you give one example of a decision that listener data changed?",
            "priority": 1
          },
          {
            "trigger": "mentions_improvement",
            "criteria": "The candidate describes changing a format, release schedule or episode structure based on what they learned.",
            "focus": "how they knew the change worked",
            "text": "How did you know the change actually worked for the audience?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "MED-02": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to explaining complicated topics in writing?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks in general terms about liking to write and explain, naming no particular piece.",
            "focus": "a piece that shows why they enjoy it",
            "text": "Can you describe a piece you wrote that shows why you enjoy this work?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions readers or audiences and what those readers need from the writing.",
            "focus": "how they decide what readers need",
            "text": "How do you decide what the reader most needs to understand?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through how you planned, researched and wrote a long guide that performed well for its audience.",
        "followups": [
          {
            "trigger": "no_measure",
            "criteria": "The candidate claims the guide performed well but gives no figure, comparison or other measure of how.",
            "focus": "how performance was measured",
            "text": "How did you measure that it performed well?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names search data, audience questions or a research method used to choose the topic and structure.",
            "focus": "how data shaped topic and structure",
            "text": "How did that research shape your choice of topic and structure?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time an expert reviewer disagreed with how you had explained something.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate describes the reviewer's disagreement but not how it was settled in the final piece.",
            "focus": "how the disagreement was resolved",
            "text": "How was it resolved in the final piece?",
            "priority": 1
          },
          {
            "trigger": "mentions_mistake",
            "criteria": "The candidate mentions an inaccuracy, a misunderstanding or a flaw in their own draft that the reviewer found.",
            "focus": "how they prevent the same error",
            "text": "What do you do now to prevent that kind of error or misunderstanding?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose you are on deadline and find a figure in your draft that you cannot confirm from a reliable source. What would you do?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's answer is ambiguous or contradictory about whether the figure would stay in the piece and what they would do first.",
            "focus": "what they would do first",
            "text": "Could you clarify what you would do first?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate would keep or publish the unverified figure without finding a source or asking a subject-matter reviewer.",
            "focus": "sourcing before publishing",
            "text": "What sourcing or expert review would you require before that claim could go out?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "Which writing skill do you most want to strengthen?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate names habits or a skill in general terms but gives no recent concrete step toward improving.",
            "focus": "a recent concrete step to improve",
            "text": "What is one concrete thing you have done recently to improve your writing?",
            "priority": 1
          },
          {
            "trigger": "mentions_leadership",
            "criteria": "The candidate mentions guiding, editing or training other writers or freelancers.",
            "focus": "how they pass skills to other writers",
            "text": "How would you pass your skills on to newer or freelance writers?",
            "priority": 2
          }
        ]
      }
    ]
  },
  "MED-03": {
    "core": [
      {
        "category": "motivation",
        "text": "What draws you to copyediting?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate speaks about loving careful editing in general terms and recalls no particular piece or manuscript.",
            "focus": "a piece where their edits mattered",
            "text": "Can you recall a particular manuscript or piece that shows why you love careful editing?",
            "priority": 1
          },
          {
            "trigger": "mentions_improvement",
            "criteria": "The candidate mentions changes they have pushed in editing practice, style rules or workflow.",
            "focus": "improvements to editing practice",
            "text": "Which improvement to editing practice has mattered most to you?",
            "priority": 2
          }
        ]
      },
      {
        "category": "experience",
        "text": "Walk me through how you design a proofing process that catches errors in a long manuscript before it goes to print.",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate explains the design of the proofing process but not how it performed once the team used it.",
            "focus": "how the process worked in practice",
            "text": "How did that process work out in practice?",
            "priority": 1
          },
          {
            "trigger": "mentions_tool_or_method",
            "criteria": "The candidate names a specific checklist, pass structure or tool used for proofing.",
            "focus": "how they decided what the checks cover",
            "text": "How did you decide what that checklist, pass structure or tool should cover?",
            "priority": 2
          }
        ]
      },
      {
        "category": "behavioral",
        "text": "Tell me about a time an author pushed back hard on your edits. How did you handle it?",
        "followups": [
          {
            "trigger": "no_outcome",
            "criteria": "The candidate describes the author's pushback and their reply but not how the matter ended.",
            "focus": "how the matter ended",
            "text": "How did that situation end up?",
            "priority": 1
          },
          {
            "trigger": "mentions_customer",
            "criteria": "The candidate mentions balancing the author's wishes against house style, accuracy or the publisher's needs.",
            "focus": "balancing author wishes and other needs",
            "text": "How did you balance the author's wishes against those other needs?",
            "priority": 2
          }
        ]
      },
      {
        "category": "scenario",
        "text": "Suppose a book is due at the printer tomorrow and you find a factual error late in the final pages. What would you do?",
        "followups": [
          {
            "trigger": "unclear_answer",
            "criteria": "The candidate's answer is ambiguous or contradictory about the order of steps.",
            "focus": "the order of their steps",
            "text": "Could you clarify the order of the steps you would take?",
            "priority": 1
          },
          {
            "trigger": "skips_safety_or_compliance_step",
            "criteria": "The candidate would change the text late without verifying the fact or getting approval from the author or managing editor.",
            "focus": "verification and approval for a late change",
            "text": "What would you verify before making a change this late?",
            "priority": 2
          }
        ]
      },
      {
        "category": "growth",
        "text": "How do you train and develop newer editors and freelancers?",
        "followups": [
          {
            "trigger": "no_specific_example",
            "criteria": "The candidate describes their approach to developing editors in general terms without naming a particular person or occasion.",
            "focus": "a specific time they helped an editor",
            "text": "Can you share one specific way you helped an editor improve?",
            "priority": 1
          },
          {
            "trigger": "strong_answer_stretch",
            "criteria": "The candidate gives a specific, complete account of developing editors, including methods and clear results.",
            "focus": "adapting when an editor resists guidance",
            "text": "Suppose an editor resisted your guidance. How would you adjust your approach?",
            "priority": 2
          }
        ]
      }
    ]
  }
}
