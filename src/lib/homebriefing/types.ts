// Homebriefing API Types

export interface HomebriefingSession {
  cookies: string;          // Full cookie string (all cookies)
  token: string;            // X-AisWeb-Token header
  userSession: string;      // UserSession for SOAP calls
  expiresAt: number;        // Timestamp when session expires
}

export interface FlightPlan {
  flId: number;
  arcid: string;            // Aircraft registration
  flRules: string;          // V=VFR, I=IFR, Y/Z=mixed
  flType: string;           // G=General, S=Scheduled, etc.
  arcType: string;          // Aircraft type ICAO code
  wakeTurbulenceCat: string;// L=Light, M=Medium, H=Heavy
  equipment: string;        // NAV/COM equipment
  adep: string;             // Departure airport ICAO
  ades: string;             // Destination airport ICAO
  adAltn1?: string;         // Alternate airport
  eobdt: string;            // Off-block datetime
  flSpeed: string;          // Speed (e.g., N0105)
  flLevel: string;          // Cruise level
  flRoute: string;          // Route
  totalEet: number;         // Estimated elapsed time (minutes)
  flOther?: string;         // Field 18 remarks
  flSuplementary?: string;  // Field 19 (survival info)
  flStatusCode: number;     // Status code
  flStatusStr: string;      // Status text
  flCanDo: number;          // Actions bitmask
}

export interface FlightPlanListResponse {
  isError: boolean;
  sessionExpired?: boolean;  // True if Homebriefing session expired
  fplsCount: number;
  totalPages: number;
  currentPage: number;
  flightPlans: FlightPlan[];
}

export interface LoginInitResult {
  sessionId: string;        // Our internal session ID
  captchaUrl: string;       // URL to fetch captcha (proxied)
}

export interface FlightMessage {
  flMsgId: number;
  isIncome: boolean;          // true = incoming message, false = outgoing
  msgTime: string;            // ISO datetime
  msgType: string;            // FPL, DEP, ARR, CHG, CNL, DLA, etc.
  statusCode: number;
  statusDesc: string;
  senderId: number;
  senderName: string;
  msgTxt: string;             // The actual ICAO message text
  toAftnAddr?: string[];      // AFTN addresses (recipients)
  aftnSender?: string;        // AFTN sender address
  aftnSendTime?: string;      // AFTN send time
}

export interface FlightMessagesResponse {
  isError: boolean;
  sessionExpired?: boolean;
  msgCount: number;
  messages: FlightMessage[];
}

export interface FlightPlanFilters {
  arcid?: string;
  adep?: string;
  ades?: string;
  flRules?: string;         // V, I, Y, Z, X (all)
  ownFlsOnly?: boolean;
  pageNumber?: number;
  pageItems?: number;
  orderColumn?: string;
  orderType?: 'ASC' | 'DESC';
  numHoursAfterETA?: number; // For current flight plans (default 3)
}

// Flight plan submission/validation types
export interface FlightPlanFormData {
  arcid: string;              // Aircraft registration (Field 7a)
  flRules: 'V' | 'I' | 'Y' | 'Z'; // Flight rules (Field 8a)
  flType: 'S' | 'N' | 'G' | 'M' | 'X'; // Type of flight (Field 8b)
  arcNum?: string;            // Number of aircraft (usually empty for single)
  arcType: string;            // Aircraft type ICAO code (Field 9b)
  wakeTurbulenceCat: 'L' | 'M' | 'H' | 'J'; // Wake turbulence (Field 9c)
  equipment: string;          // NAV/COM equipment (Field 10)
  adep: string;               // Departure aerodrome (Field 13a)
  eobdt: string;              // Off-block date/time "YYYY-MM-DD HH:mm" (Field 13b)
  flSpeed: string;            // Cruising speed (Field 15a)
  flLevel: string;            // Cruising level (Field 15b)
  flRoute: string;            // Route (Field 15c)
  ades: string;               // Destination aerodrome (Field 16a)
  totalEet: number;           // Total EET in minutes (Field 16b)
  adAltn1?: string;           // 1st alternate (Field 16c)
  adAltn2?: string;           // 2nd alternate (Field 16d)
  flOther?: string;           // Other information Field 18
  flSuplementary?: string;    // Field 19 (survival info)
  pilotTel?: string;          // Pilot telephone number
}

export interface FieldError {
  field: string;      // Field name (e.g., 'ARCID', 'ADEP', 'FlRoute')
  message: string;    // Error message
}

export interface FlightPlanValidationResponse {
  isError: boolean;
  sessionExpired?: boolean;
  fplIsOk: boolean;
  errorMessages?: string[];
  fieldErrors?: FieldError[];  // Field-specific validation errors
  rawResponse?: string;        // For debugging
}

export interface FlightPlanSubmitResponse {
  isError: boolean;
  success: boolean;
  flId?: number;              // New flight plan ID if successful
  errorMessages?: string[];
}

// Flight plan template types
export interface FlightPlanTemplateListItem {
  tplId: number;
  tplName: string;
}

export interface FlightPlanTemplateListResponse {
  isError: boolean;
  sessionExpired?: boolean;
  count: number;
  templates: FlightPlanTemplateListItem[];
}

export interface FlightPlanTemplateData {
  tplId: number;
  tplName: string;
  arcid: string;
  flRules: string;
  flType: string;
  arcType: string;
  wakeTurbulenceCat: string;
  equipment10a: string;       // Equipment Field 10a (COM/NAV)
  equipment10b: string;       // Equipment Field 10b (SSR)
  equipment10c: string;       // Equipment Field 10c (ADS)
  adep: string;
  eobt: string;               // HHMM format
  flSpeedMeasure: string;     // N=knots, K=km/h, M=mach
  flSpeedValue: string;
  flLevelMeasure: string;     // F=FL, A=altitude, VFR, etc.
  flLevelValue?: string;
  ades?: string;
  flRoute?: string;
  totalEet?: number;
  adAltn1?: string;
  adAltn2?: string;
  flOther?: string;
  // Field 19 survival equipment
  radio?: string;
  survival?: string;
  jackets?: string;
  dinghies?: string;
  dinghiesNumber?: string;
  dinghiesCapacity?: string;
  dinghiesCover?: boolean;
  dinghiesColour?: string;
  aircraftColour?: string;
  remarks?: string;
  pilotInCommand?: string;
  pilotTel?: string;
}

export interface FlightPlanTemplateResponse {
  isError: boolean;
  sessionExpired?: boolean;
  found: boolean;
  template?: FlightPlanTemplateData;
}

export interface SaveTemplateRequest {
  tplName: string;
  tplId?: number;                // Empty for new, existing ID to overwrite
  formData: FlightPlanFormData;
  field19?: {
    radio?: string;
    survival?: string;
    jackets?: string;
    dinghiesNumber?: string;
    dinghiesCapacity?: string;
    dinghiesCover?: boolean;
    dinghiesColour?: string;
    aircraftColour?: string;
    remarks?: string;
    pilotInCommand?: string;
    endurance?: string;
    persons?: string;
  };
}

export interface SaveTemplateResponse {
  isError: boolean;
  sessionExpired?: boolean;
  success: boolean;
  errorMessage?: string;
  rawResponse?: string;  // For debugging when save fails
}

export interface DeleteTemplateResponse {
  isError: boolean;
  sessionExpired?: boolean;
  success: boolean;
  deletedTplId?: number;
  errorMessage?: string;
}
