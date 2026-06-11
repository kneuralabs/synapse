// Static reference data for the Levitate Autonomous Experience Orchestration Platform.

export const CHANNELS = [
  {id:'web',     name:'Web',            icon:'🌐'},
  {id:'mobile',  name:'Mobile',         icon:'📱'},
  {id:'email',   name:'Email',          icon:'✉️'},
  {id:'social',  name:'Social',         icon:'💬'},
  {id:'contact', name:'Contact Center', icon:'🎧'},
  {id:'store',   name:'In-store / IoT', icon:'🏬'},
  {id:'partner', name:'Partner Portal', icon:'🤝'}
];

export const AGENTS = [
  {id:'service',   name:'Service Agent',   scope:'Issue resolution & support',     color:'#6C7FFF'},
  {id:'sales',     name:'Sales Agent',     scope:'Conversion & retention offers',  color:'#4FFFB0'},
  {id:'care',      name:'Care Agent',      scope:'Sentiment & proactive outreach', color:'#FFD97D'},
  {id:'ops',       name:'Ops Agent',       scope:'Fulfilment & system actions',    color:'#FF6B6B'},
  {id:'marketing', name:'Marketing Agent', scope:'Personalization & campaigns',    color:'#A78BFA'}
];

export const CUSTOMERS = [
  {id:'C-1042', name:'Amara Okafor',   segment:'Premium',    ltv:18400, tenure:'4 yrs', channelPref:'mobile', sentiment:72,
   journey:'Renewal', persona:'High-value subscriber, low tolerance for friction.'},
  {id:'C-2207', name:'Diego Ramírez',  segment:'Growth',     ltv:6200,  tenure:'14 mo', channelPref:'web', sentiment:58,
   journey:'Onboarding', persona:'New power-user, exploring advanced features.'},
  {id:'C-3315', name:'Mei-Lin Chow',   segment:'Premium',    ltv:24750, tenure:'6 yrs', channelPref:'email', sentiment:81,
   journey:'Expansion', persona:'Long-tenure advocate, responds to early access.'},
  {id:'C-4521', name:'Tunde Adeyemi',  segment:'Standard',   ltv:2900,  tenure:'8 mo',  channelPref:'social', sentiment:44,
   journey:'At-risk', persona:'Price-sensitive, two recent support escalations.'},
  {id:'C-5188', name:'Sofia Petrova',  segment:'Growth',     ltv:8100,  tenure:'2 yrs', channelPref:'contact', sentiment:63,
   journey:'Support', persona:'Frequent contact-center caller, prefers humans.'},
  {id:'C-6090', name:'James Whitfield',segment:'Enterprise', ltv:96000, tenure:'3 yrs', channelPref:'partner', sentiment:69,
   journey:'Renewal', persona:'B2B account owner, contract renews next quarter.'},
  {id:'C-7732', name:'Yuki Tanaka',    segment:'Standard',   ltv:1850,  tenure:'5 mo',  channelPref:'mobile', sentiment:55,
   journey:'Onboarding', persona:'Trial convert, hasn’t activated key features.'},
  {id:'C-8414', name:'Fatima Al-Rashid',segment:'Premium',   ltv:15300, tenure:'5 yrs', channelPref:'store', sentiment:77,
   journey:'Loyalty', persona:'Omnichannel shopper, high in-store attachment.'}
];

// Problem templates the detection layer draws from. `risk` drives the
// human-in-the-loop gate; `playbook` is the autonomous resolution plan.
export const ISSUE_TEMPLATES = [
  {type:'Payment failure', channel:'web', severity:'high', risk:'low', agent:'ops',
   detail:'Card declined at checkout — third retry failed.',
   playbook:['Verify gateway status & retry with backup processor','Hold cart for 24h so nothing is lost','Send one-tap payment-update link via preferred channel'],
   resolution:'Payment rerouted through backup processor and order completed. Customer notified.', value:120, mins:38},
  {type:'Delivery delay', channel:'email', severity:'medium', risk:'low', agent:'ops',
   detail:'Order tracking shows no movement for 48 hours.',
   playbook:['Query carrier API for real status','Re-book on express carrier if stalled','Proactively notify customer with new ETA + goodwill credit'],
   resolution:'Shipment re-booked on express carrier; customer notified with new ETA and $10 credit.', value:85, mins:52},
  {type:'Billing dispute', channel:'contact', severity:'high', risk:'high', agent:'service',
   detail:'Customer disputes a duplicate subscription charge.',
   playbook:['Reconcile invoices against payment-gateway records','Draft refund for the duplicate charge','Apply refund and send confirmation (requires approval)'],
   resolution:'Duplicate charge confirmed and refunded in full. Apology + confirmation sent.', value:240, mins:65},
  {type:'App crash on checkout', channel:'mobile', severity:'high', risk:'low', agent:'service',
   detail:'Crash loop reported on app v4.2.1 during payment step.',
   playbook:['Match crash signature to known issue KB-2291','Push remote-config flag to disable failing module','Notify affected cohort with workaround'],
   resolution:'Remote-config rollback applied; crash rate back to baseline. Affected users notified.', value:310, mins:24},
  {type:'Churn risk signal', channel:'web', severity:'medium', risk:'high', agent:'sales',
   detail:'Usage down 60% month-over-month; cancellation page visited.',
   playbook:['Score churn propensity from digital-twin signals','Select retention offer via next-best-action engine','Deliver personalized offer (requires approval)'],
   resolution:'Personalized retention offer accepted — plan downgraded instead of cancelled.', value:480, mins:90},
  {type:'Negative social mention', channel:'social', severity:'medium', risk:'medium', agent:'care',
   detail:'Public complaint about support wait times gaining traction.',
   playbook:['Classify sentiment & reach of the post','Respond publicly with acknowledgement','Open priority support ticket and DM the customer'],
   resolution:'Public response posted within minutes; issue moved to DM and resolved. Post sentiment recovered.', value:150, mins:31},
  {type:'Onboarding stall', channel:'mobile', severity:'low', risk:'low', agent:'marketing',
   detail:'Key activation step not completed 7 days after signup.',
   playbook:['Identify the abandoned step from event stream','Generate contextual walkthrough content','Trigger in-app guide + follow-up nudge'],
   resolution:'In-app walkthrough delivered; activation step completed same session.', value:95, mins:18},
  {type:'Wrong item delivered', channel:'store', severity:'high', risk:'medium', agent:'ops',
   detail:'Click-and-collect order picked incorrectly at store #214.',
   playbook:['Locate correct SKU in nearby store inventory','Book same-day courier swap','Issue loyalty points for the inconvenience'],
   resolution:'Correct item couriered same-day; 500 loyalty points credited.', value:110, mins:47},
  {type:'Login lockout', channel:'web', severity:'medium', risk:'low', agent:'service',
   detail:'Repeated 2FA failures — customer locked out of account.',
   playbook:['Verify identity from device & behavioural signals','Reset 2FA enrolment securely','Send recovery link via verified channel'],
   resolution:'Identity verified, 2FA re-enrolled, customer back in account.', value:60, mins:12},
  {type:'Partner API errors', channel:'partner', severity:'high', risk:'medium', agent:'ops',
   detail:'Partner portal order API returning 5xx for one integration.',
   playbook:['Correlate errors to last config change','Roll back connector config via MCP gateway','Replay failed orders from event stream'],
   resolution:'Connector config rolled back; 37 failed orders replayed successfully.', value:520, mins:41},
  {type:'Refund not received', channel:'contact', severity:'medium', risk:'high', agent:'service',
   detail:'Refund approved 10 days ago but never landed.',
   playbook:['Trace refund through gateway settlement logs','Re-issue refund to original payment method (requires approval)','Confirm with customer and add goodwill credit'],
   resolution:'Refund re-issued and confirmed received. Goodwill credit applied.', value:175, mins:58},
  {type:'Price mismatch', channel:'web', severity:'low', risk:'low', agent:'marketing',
   detail:'Promo price shown in email differs from checkout price.',
   playbook:['Validate active promotions in campaign engine','Honor the advertised price via cart-level adjustment','Fix the campaign config to prevent recurrence'],
   resolution:'Advertised price honored at checkout; campaign config corrected.', value:45, mins:9}
];

export const STAGES = ['Detected','Triaged','Deciding','Acting','Resolved'];

export const JOURNEYS = [
  {name:'Onboarding', stages:['Signup','Activation','First value','Habit'], health:74,
   nba:'Trigger contextual walkthroughs at the first abandoned step.'},
  {name:'Support', stages:['Issue raised','Triage','Resolution','Follow-up'], health:88,
   nba:'Auto-resolve known signatures; route novel issues to humans with full context.'},
  {name:'Renewal', stages:['Usage review','Value recap','Offer','Commit'], health:81,
   nba:'Send personalized value recap 30 days before renewal date.'},
  {name:'At-risk', stages:['Signal','Diagnose','Intervene','Recover'], health:62,
   nba:'Intervene within 24h of a churn signal with a tailored retention offer.'},
  {name:'Expansion', stages:['Signal','Qualify','Propose','Adopt'], health:79,
   nba:'Offer early access to features adjacent to current heavy usage.'}
];

export const GUARDRAILS = [
  {name:'Refunds & credits above $50', policy:'Human approval required', on:true},
  {name:'Retention offers & discounts', policy:'Human approval required', on:true},
  {name:'Public social responses', policy:'Brand-safety check before send', on:true},
  {name:'PII handling', policy:'Zero-trust — masked in all agent contexts', on:true},
  {name:'Bias & fairness', policy:'Offer parity monitored across segments', on:true},
  {name:'Model governance', policy:'All prompts & outputs logged for audit', on:true}
];
