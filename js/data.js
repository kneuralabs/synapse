// Static reference data for the Synapse Autonomous Experience Orchestration Platform.

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

export const STAGES = ['Detected','Triaged','Deciding','Acting','Resolved'];

export const GUARDRAILS = [
  {name:'Refunds & credits above $50', policy:'Human approval required', on:true},
  {name:'Retention offers & discounts', policy:'Human approval required', on:true},
  {name:'Public social responses', policy:'Brand-safety check before send', on:true},
  {name:'PII handling', policy:'Zero-trust — masked in all agent contexts', on:true},
  {name:'Bias & fairness', policy:'Offer parity monitored across segments', on:true},
  {name:'Model governance', policy:'All prompts & outputs logged for audit', on:true}
];
