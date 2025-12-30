import { FlightPlan, FlightPlanFilters, FlightPlanListResponse, FlightMessage, FlightMessagesResponse, FlightPlanFormData, FlightPlanValidationResponse, FlightPlanSubmitResponse, FieldError, FlightPlanTemplateListResponse, FlightPlanTemplateListItem, FlightPlanTemplateResponse, FlightPlanTemplateData, SaveTemplateRequest, SaveTemplateResponse, DeleteTemplateResponse, FlightPlanActionResponse } from './types';

const BASE_URL = 'https://hbs.ixosystem.eu/ixo';

// Session expiry detection patterns
const SESSION_EXPIRY_PATTERNS = [
  /session.*expired/i,
  /invalid.*session/i,
  /not.*logged.*in/i,
  /login.*required/i,
  /authentication.*failed/i,
  /unauthorized/i,
];

// Check if response indicates session expiry
export function isSessionExpiredResponse(xml: string): boolean {
  // Check for common session expiry error patterns
  for (const pattern of SESSION_EXPIRY_PATTERNS) {
    if (pattern.test(xml)) {
      return true;
    }
  }

  // Check for empty or redirect responses (often indicate session issues)
  if (xml.includes('<!DOCTYPE html') || xml.includes('<html')) {
    // Got HTML instead of XML - likely a login redirect
    return true;
  }

  return false;
}

interface InitLoginResult {
  cookies: string;  // Full cookie string with all cookies
  token: string;
}

interface LoginResult {
  success: boolean;
  cookies?: string;
  token?: string;
  userSession?: string;
  error?: string;
}

// Helper to extract cookies from set-cookie headers
function extractCookies(response: Response): Map<string, string> {
  const cookies = new Map<string, string>();
  const setCookieHeader = response.headers.get('set-cookie');

  if (setCookieHeader) {
    // Parse multiple cookies (they may be comma-separated or in multiple headers)
    const cookieParts = setCookieHeader.split(/,(?=[^;]+=[^;]+)/);
    for (const part of cookieParts) {
      const match = part.match(/^([^=]+)=([^;]+)/);
      if (match) {
        cookies.set(match[1].trim(), match[2].trim());
      }
    }
  }

  return cookies;
}

// Helper to merge cookies and format as header string
function mergeCookies(existing: string, newCookies: Map<string, string>): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  if (existing) {
    for (const part of existing.split('; ')) {
      const [key, value] = part.split('=');
      if (key && value) {
        cookieMap.set(key, value);
      }
    }
  }

  // Merge new cookies
  for (const [key, value] of newCookies) {
    cookieMap.set(key, value);
  }

  // Format as cookie header string
  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

export class HomebriefingClient {
  // Step 1: Initialize login - get session cookie and token
  async initLogin(): Promise<InitLoginResult> {
    const response = await fetch(`${BASE_URL}/login.php`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'manual',
    });

    // Extract all cookies
    const cookieMap = extractCookies(response);
    const cookies = mergeCookies('', cookieMap);

    if (!cookieMap.has('__Host-IxoWeb-NL')) {
      throw new Error('Failed to get session cookie');
    }

    // Extract token from HTML
    const html = await response.text();
    const tokenMatch = html.match(/AWLoginDataHandler\.setToken\("([^"]+)"\)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (!token) {
      throw new Error('Failed to get token from login page');
    }

    console.log('Init cookies:', cookies);
    return { cookies, token };
  }

  // Step 2: Get captcha image
  async getCaptcha(cookies: string): Promise<ArrayBuffer> {
    const response = await fetch(`${BASE_URL}/dataHandler.php?method=captchaGenerate`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
      },
    });

    return response.arrayBuffer();
  }

  // Step 3: Submit login
  async submitLogin(
    cookies: string,
    token: string,
    username: string,
    password: string,
    captcha: string
  ): Promise<LoginResult> {
    // Submit login request
    const loginResponse = await fetch(`${BASE_URL}/dataHandler.php?method=loginExt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: new URLSearchParams({
        userName: username,
        password: password,
        lang: 'en',
        captcha: captcha,
      }),
    });

    if (!loginResponse.ok) {
      return { success: false, error: 'Login request failed' };
    }

    // Merge any new cookies from login response
    const loginCookies = extractCookies(loginResponse);
    let currentCookies = mergeCookies(cookies, loginCookies);

    // Check response for errors
    const responseText = await loginResponse.text();
    console.log('Login response:', responseText);

    // Check for SOAP error response
    if (responseText.includes('<IsError>1</IsError>') || responseText.includes('<LoginOK>0</LoginOK>')) {
      return { success: false, error: 'Invalid credentials or captcha' };
    }

    // After successful login, fetch index.php to get new token and userSession
    const indexResponse = await fetch(`${BASE_URL}/index.php`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': currentCookies,
      },
      redirect: 'manual',
    });

    // Merge any new cookies from index response
    const indexCookies = extractCookies(indexResponse);
    currentCookies = mergeCookies(currentCookies, indexCookies);

    console.log('After index.php, cookies:', currentCookies);
    console.log('Index response status:', indexResponse.status);

    // Check for redirect (means we need to follow it)
    if (indexResponse.status === 302) {
      const location = indexResponse.headers.get('location');
      console.log('Index redirect to:', location);
      if (location?.includes('login.php')) {
        return { success: false, error: 'Login failed - redirected back to login' };
      }
    }

    // Get the actual page content (follow redirect if needed)
    let indexHtml: string;
    if (indexResponse.status === 302) {
      const redirectResponse = await fetch(`${BASE_URL}/index.php`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': currentCookies,
        },
      });
      // Merge cookies again
      const redirectCookies = extractCookies(redirectResponse);
      currentCookies = mergeCookies(currentCookies, redirectCookies);
      indexHtml = await redirectResponse.text();
    } else {
      indexHtml = await indexResponse.text();
    }

    // Extract AppController parameters: new AppController("token", "userSession", "baseUrl")
    const appCtrlMatch = indexHtml.match(/new\s+AppController\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/);
    if (!appCtrlMatch) {
      console.log('Index HTML (first 500 chars):', indexHtml.substring(0, 500));
      return { success: false, error: 'Failed to extract session data after login' };
    }

    const newToken = appCtrlMatch[1];
    const userSession = appCtrlMatch[2];

    return {
      success: true,
      cookies: currentCookies,
      token: newToken,
      userSession,
    };
  }

  // Get current/active flight plans
  async getCurrentFlightPlans(
    cookies: string,
    token: string,
    userSession: string,
    filters: FlightPlanFilters = {}
  ): Promise<FlightPlanListResponse> {
    const {
      arcid = '',
      adep = '',
      ades = '',
      flRules = 'X',
      ownFlsOnly = false,
      pageNumber = 0,
      pageItems = 25,
      orderColumn = 'COL_EOBDT',
      orderType = 'DESC',
      numHoursAfterETA = 3,
    } = filters;

    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/">
  <soapenv:Body>
    <mob:GetFPLListRequest>
      <mob:NumHoursAfterETA>${numHoursAfterETA}</mob:NumHoursAfterETA>
      <mob:UserSession>${userSession}</mob:UserSession>
      <mob:PageNumber>${pageNumber}</mob:PageNumber>
      <mob:PageItems>${pageItems}</mob:PageItems>
      <mob:ARCID>${arcid}</mob:ARCID>
      <mob:ADEP>${adep}</mob:ADEP>
      <mob:ADES>${ades}</mob:ADES>
      <mob:FlRules>${flRules}</mob:FlRules>
      <mob:OwnFls>${ownFlsOnly}</mob:OwnFls>
      <mob:OrderColumn>${orderColumn}</mob:OrderColumn>
      <mob:OrderType>${orderType}</mob:OrderType>
    </mob:GetFPLListRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseFlightPlansResponse(xmlText);
  }

  // Get archived flight plans
  async getArchivedFlightPlans(
    cookies: string,
    token: string,
    userSession: string,
    filters: FlightPlanFilters = {}
  ): Promise<FlightPlanListResponse> {
    const {
      arcid = '',
      adep = '',
      ades = '',
      flRules = 'X',
      ownFlsOnly = false,
      pageNumber = 0,
      pageItems = 25,
      orderColumn = 'COL_EOBDT',
      orderType = 'DESC',
    } = filters;

    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/">
  <soapenv:Body>
    <mob:GetFPLArchiveRequest>
      <mob:UserSession>${userSession}</mob:UserSession>
      <mob:PageNumber>${pageNumber}</mob:PageNumber>
      <mob:PageItems>${pageItems}</mob:PageItems>
      <mob:ARCID>${arcid}</mob:ARCID>
      <mob:ADEP>${adep}</mob:ADEP>
      <mob:ADES>${ades}</mob:ADES>
      <mob:FlRules>${flRules}</mob:FlRules>
      <mob:OwnFls>${ownFlsOnly}</mob:OwnFls>
      <mob:OrderColumn>${orderColumn}</mob:OrderColumn>
      <mob:OrderType>${orderType}</mob:OrderType>
    </mob:GetFPLArchiveRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseFlightPlansResponse(xmlText);
  }

  // Get flight plan messages/details
  async getFlightPlanMessages(
    cookies: string,
    token: string,
    userSession: string,
    flId: number
  ): Promise<FlightMessagesResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/">
  <soapenv:Body>
    <mob:GetFlMsgListRequest>
      <mob:FlId>${flId}</mob:FlId>
      <mob:UserSession>${userSession}</mob:UserSession>
    </mob:GetFlMsgListRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseFlightMessagesResponse(xmlText);
  }

  private parseFlightMessagesResponse(xml: string): FlightMessagesResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        msgCount: 0,
        messages: [],
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    // For MsgTxt which can contain newlines
    const getMultilineTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([\\s\\S]*?)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const msgCount = parseInt(getTagValue('MsgCount', xml)) || 0;

    // Parse messages array - element is MsgArray
    const messages: FlightMessage[] = [];
    const msgArrayRegex = /<(?:ns1:)?MsgArray>([\s\S]*?)<\/(?:ns1:)?MsgArray>/gi;
    let match;

    while ((match = msgArrayRegex.exec(xml)) !== null) {
      const msgXml = match[1];

      // Parse AFTN addresses array (note: lowercase 'to' in toAFTNAddr)
      const toAftnAddr: string[] = [];
      const aftnAddrRegex = /<(?:ns1:)?toAFTNAddr>([^<]*)<\/(?:ns1:)?toAFTNAddr>/gi;
      let addrMatch;
      while ((addrMatch = aftnAddrRegex.exec(msgXml)) !== null) {
        if (addrMatch[1]) toAftnAddr.push(addrMatch[1]);
      }

      messages.push({
        flMsgId: parseInt(getTagValue('FlMsgId', msgXml)) || 0,
        isIncome: getTagValue('IsIncome', msgXml) === '1',
        msgTime: getTagValue('MsgTime', msgXml),
        msgType: getTagValue('MsgType', msgXml),
        statusCode: parseInt(getTagValue('StatusCode', msgXml)) || 0,
        statusDesc: getTagValue('StatusDesc', msgXml),
        senderId: parseInt(getTagValue('SenderId', msgXml)) || 0,
        senderName: getTagValue('SenderName', msgXml),
        msgTxt: getMultilineTagValue('MsgTxt', msgXml),
        toAftnAddr: toAftnAddr.length > 0 ? toAftnAddr : undefined,
        aftnSender: getTagValue('AftnSender', msgXml) || undefined,
        aftnSendTime: getTagValue('AftnSendTime', msgXml) || undefined,
      });
    }

    return {
      isError,
      msgCount,
      messages,
    };
  }

  private parseFlightPlansResponse(xml: string): FlightPlanListResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        fplsCount: 0,
        totalPages: 0,
        currentPage: 0,
        flightPlans: [],
      };
    }

    // Simple XML parsing (in production, use a proper XML parser)
    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const fplsCount = parseInt(getTagValue('FPLsCount', xml)) || 0;
    const totalPages = parseInt(getTagValue('TotalPages', xml)) || 0;
    const currentPage = parseInt(getTagValue('CurrentPage', xml)) || 0;

    // Parse flight plans array
    const flightPlans: FlightPlan[] = [];
    const fplArrayRegex = /<(?:ns1:)?FPLsArray>([\s\S]*?)<\/(?:ns1:)?FPLsArray>/gi;
    let match;

    while ((match = fplArrayRegex.exec(xml)) !== null) {
      const fplXml = match[1];
      flightPlans.push({
        flId: parseInt(getTagValue('FlId', fplXml)) || 0,
        arcid: getTagValue('ARCID', fplXml),
        flRules: getTagValue('FlRules', fplXml),
        flType: getTagValue('FlType', fplXml),
        arcType: getTagValue('ArcType', fplXml),
        wakeTurbulenceCat: getTagValue('WakeTurbulenceCat', fplXml),
        equipment: getTagValue('Equipment', fplXml),
        adep: getTagValue('ADEP', fplXml),
        ades: getTagValue('ADES', fplXml),
        adAltn1: getTagValue('ADAltn1', fplXml) || undefined,
        eobdt: getTagValue('EOBDT', fplXml),
        flSpeed: getTagValue('FlSpeed', fplXml),
        flLevel: getTagValue('FlLevel', fplXml),
        flRoute: getTagValue('FlRoute', fplXml),
        totalEet: parseInt(getTagValue('TotalEET', fplXml)) || 0,
        flOther: getTagValue('FlOther', fplXml) || undefined,
        flSuplementary: getTagValue('FlSuplementary', fplXml) || undefined,
        flStatusCode: parseInt(getTagValue('FlStatusCode', fplXml)) || 0,
        flStatusStr: getTagValue('FlStatusStr', fplXml),
        flCanDo: parseInt(getTagValue('FlCanDo', fplXml)) || 0,
      });
    }

    return {
      isError,
      fplsCount,
      totalPages,
      currentPage,
      flightPlans,
    };
  }

  // Validate flight plan before submission
  async validateFlightPlan(
    cookies: string,
    token: string,
    userSession: string,
    formData: FlightPlanFormData
  ): Promise<FlightPlanValidationResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/">
  <soapenv:Body>
    <mob:CheckFplValidityRequest>
      <mob:FlAttributes>
        <ARCID>${this.escapeXml(formData.arcid)}</ARCID>
        <FlRules>${formData.flRules}</FlRules>
        <FlType>${formData.flType}</FlType>
        <ArcNum>${formData.arcNum || ''}</ArcNum>
        <ArcType>${this.escapeXml(formData.arcType)}</ArcType>
        <WakeTurbulenceCat>${formData.wakeTurbulenceCat}</WakeTurbulenceCat>
        <Equipment>${this.escapeXml(formData.equipment)}</Equipment>
        <ADEP>${this.escapeXml(formData.adep)}</ADEP>
        <EOBDT>${formData.eobdt}</EOBDT>
        <FlSpeed>${this.escapeXml(formData.flSpeed)}</FlSpeed>
        <FlLevel>${this.escapeXml(formData.flLevel)}</FlLevel>
        <FlRoute>${this.escapeXml(formData.flRoute)}</FlRoute>
        <ADES>${this.escapeXml(formData.ades)}</ADES>
        <ADAltn1>${this.escapeXml(formData.adAltn1 || '')}</ADAltn1>
        <ADAltn2>${this.escapeXml(formData.adAltn2 || '')}</ADAltn2>
        <TotalEET>${formData.totalEet}</TotalEET>
        <FlOther>${this.escapeXml(formData.flOther || '')}</FlOther>
        <FlSuplementary>${this.escapeXml(formData.flSuplementary || '')}</FlSuplementary>
        <AddInfoPilottel>${this.escapeXml(formData.pilotTel || '')}</AddInfoPilottel>
      </mob:FlAttributes>
      <mob:UseNMB2B>0</mob:UseNMB2B>
      <mob:UserSession>${userSession}</mob:UserSession>
    </mob:CheckFplValidityRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseValidationResponse(xmlText);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private parseValidationResponse(xml: string): FlightPlanValidationResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        fplIsOk: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const fplIsOk = getTagValue('FplIsOk', xml) === '1';

    // Extract FplErrors - the main error format from Homebriefing
    // Format: <ns1:FplErrors>F7 Invalid Aircraft Identification</ns1:FplErrors>
    const fieldErrors: FieldError[] = [];
    const fplErrorsRegex = /<(?:ns1:)?FplErrors>([^<]*)<\/(?:ns1:)?FplErrors>/gi;
    let fplMatch;
    while ((fplMatch = fplErrorsRegex.exec(xml)) !== null) {
      const errorText = fplMatch[1];
      if (errorText) {
        // Parse field code from error message (e.g., "F7 Invalid..." -> field "F7")
        const fieldMatch = errorText.match(/^(F\d+[a-z]?|FAddinfo\w+)\s+(.+)$/i);
        if (fieldMatch) {
          fieldErrors.push({
            field: fieldMatch[1],
            message: fieldMatch[2]
          });
        } else {
          // No field prefix found, treat as general error
          fieldErrors.push({ field: 'General', message: errorText });
        }
      }
    }

    // Also extract any ErrMsg tags as fallback
    const errorMessages: string[] = [];
    const errorRegex = /<(?:ns1:)?ErrMsg>([^<]*)<\/(?:ns1:)?ErrMsg>/gi;
    let match;
    while ((match = errorRegex.exec(xml)) !== null) {
      if (match[1]) errorMessages.push(match[1]);
    }

    // Log for debugging if validation failed but no errors found
    if (!fplIsOk && fieldErrors.length === 0 && errorMessages.length === 0) {
      console.log('Validation failed but no error details found. Raw response:', xml);
    }

    return {
      isError,
      fplIsOk,
      errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
      fieldErrors: fieldErrors.length > 0 ? fieldErrors : undefined,
      rawResponse: !fplIsOk ? xml : undefined,  // Include raw response on failure for debugging
    };
  }

  // Get list of flight plan templates
  async getTemplateList(
    cookies: string,
    token: string,
    userSession: string
  ): Promise<FlightPlanTemplateListResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:GetFlTplListRequest><mob:UserSession>${userSession}</mob:UserSession></mob:GetFlTplListRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseTemplateListResponse(xmlText);
  }

  private parseTemplateListResponse(xml: string): FlightPlanTemplateListResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        count: 0,
        templates: [],
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const count = parseInt(getTagValue('FlTplCount', xml)) || 0;

    const templates: FlightPlanTemplateListItem[] = [];
    const tplArrayRegex = /<(?:ns1:)?FlTplArray>([\s\S]*?)<\/(?:ns1:)?FlTplArray>/gi;
    let match;

    while ((match = tplArrayRegex.exec(xml)) !== null) {
      const tplXml = match[1];
      templates.push({
        tplId: parseInt(getTagValue('TplId', tplXml)) || 0,
        tplName: getTagValue('TplName', tplXml),
      });
    }

    return { isError, count, templates };
  }

  // Get a specific flight plan template
  async getTemplate(
    cookies: string,
    token: string,
    userSession: string,
    tplId: number
  ): Promise<FlightPlanTemplateResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:GetFlTplRequest><mob:UserSession>${userSession}</mob:UserSession><mob:TplId>${tplId}</mob:TplId></mob:GetFlTplRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseTemplateResponse(xmlText);
  }

  private parseTemplateResponse(xml: string): FlightPlanTemplateResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        found: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const found = getTagValue('FlTplFound', xml) === '1';

    if (!found) {
      return { isError, found };
    }

    // Extract FlTplValues section
    const valuesMatch = xml.match(/<(?:ns1:)?FlTplValues>([\s\S]*?)<\/(?:ns1:)?FlTplValues>/i);
    if (!valuesMatch) {
      return { isError, found: false };
    }

    const valuesXml = valuesMatch[1];

    const template: FlightPlanTemplateData = {
      tplId: parseInt(getTagValue('TplId', valuesXml)) || 0,
      tplName: getTagValue('TplName', valuesXml),
      arcid: getTagValue('ARCID', valuesXml),
      flRules: getTagValue('FlRules', valuesXml),
      flType: getTagValue('FlType', valuesXml),
      arcType: getTagValue('ArcType', valuesXml),
      wakeTurbulenceCat: getTagValue('WakeTurbulenceCat', valuesXml),
      equipment10a: getTagValue('Equipment_10a', valuesXml),
      equipment10b: getTagValue('Equipment_10b', valuesXml),
      equipment10c: getTagValue('Equipment_10c', valuesXml),
      adep: getTagValue('ADEP', valuesXml),
      eobt: getTagValue('EOBT', valuesXml),
      flSpeedMeasure: getTagValue('FlSpeedMeasure', valuesXml),
      flSpeedValue: getTagValue('FlSpeedValue', valuesXml).trim(),
      flLevelMeasure: getTagValue('FlLevelMeasure', valuesXml),
      flLevelValue: getTagValue('FlLevelValue', valuesXml) || undefined,
      ades: getTagValue('ADES', valuesXml) || undefined,
      flRoute: getTagValue('FlRoute', valuesXml) || undefined,
      totalEet: parseInt(getTagValue('TotalEET', valuesXml)) || undefined,
      adAltn1: getTagValue('ADAltn1', valuesXml) || undefined,
      adAltn2: getTagValue('ADAltn2', valuesXml) || undefined,
      flOther: getTagValue('FlOther', valuesXml) || undefined,
      // Field 19 survival equipment
      radio: getTagValue('Radio', valuesXml) || undefined,
      survival: getTagValue('Survival', valuesXml) || undefined,
      jackets: getTagValue('Jackets', valuesXml) || undefined,
      dinghies: getTagValue('Dinghies', valuesXml) || undefined,
      dinghiesNumber: getTagValue('DinghiesNumber', valuesXml) || undefined,
      dinghiesCapacity: getTagValue('DinghiesCapacity', valuesXml) || undefined,
      dinghiesCover: getTagValue('DinghiesCover', valuesXml) === 'true',
      dinghiesColour: getTagValue('DinghiesColour', valuesXml) || undefined,
      aircraftColour: getTagValue('AircraftColour_A', valuesXml) || undefined,
      remarks: getTagValue('Remarks_J', valuesXml) || undefined,
      pilotInCommand: getTagValue('PilotInCmd_C', valuesXml) || undefined,
      pilotTel: getTagValue('PilotTel', valuesXml) || undefined,
    };

    return { isError, found, template };
  }

  // Save a flight plan as template
  async saveTemplate(
    cookies: string,
    token: string,
    userSession: string,
    request: SaveTemplateRequest
  ): Promise<SaveTemplateResponse> {
    const { tplName, tplId, formData, field19 } = request;

    // Parse equipment string (e.g., "SGOVY/S" -> 10a="SGOVY", 10b="S")
    const equipmentParts = (formData.equipment || '').split('/');
    const equipment10a = equipmentParts[0] || '';
    const equipment10b = equipmentParts[1] || '';

    // Parse speed (e.g., "N0105" -> measure="N", value="0105")
    const speedMatch = formData.flSpeed?.match(/^([NKM])(\d+)/);
    const flSpeedMeasure = speedMatch ? speedMatch[1] : 'N';
    const flSpeedValue = speedMatch ? speedMatch[2] : '';

    // Parse level (e.g., "VFR" or "F065" or "A025")
    let flLevelMeasure = 'VFR';
    let flLevelValue = '';
    if (formData.flLevel) {
      if (formData.flLevel === 'VFR') {
        flLevelMeasure = 'VFR';
      } else {
        const levelMatch = formData.flLevel.match(/^([FAM])(\d+)/);
        if (levelMatch) {
          flLevelMeasure = levelMatch[1];
          flLevelValue = levelMatch[2];
        }
      }
    }

    // Build radio string from field19
    let radio = '';
    if (field19?.radio) {
      radio = field19.radio;
    }

    // Build survival string
    const survival = field19?.survival || '';
    const jackets = field19?.jackets || '';

    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:SaveFlTplRequest><mob:FlTplValues><FlTplId><TplName>${this.escapeXml(tplName)}</TplName><TplId>${tplId || ''}</TplId></FlTplId><ARCID>${this.escapeXml(formData.arcid)}</ARCID><FlRules>${formData.flRules}</FlRules><FlType>${formData.flType}</FlType><ArcNum>${formData.arcNum || ''}</ArcNum><ArcType>${this.escapeXml(formData.arcType)}</ArcType><WakeTurbulenceCat>${formData.wakeTurbulenceCat}</WakeTurbulenceCat><Equipment_10a>${this.escapeXml(equipment10a)}</Equipment_10a><Equipment_10b>${this.escapeXml(equipment10b)}</Equipment_10b><Equipment_10c>N</Equipment_10c><ADEP>${this.escapeXml(formData.adep)}</ADEP><EOBT></EOBT><FlSpeedMeasure>${flSpeedMeasure}</FlSpeedMeasure><FlSpeedValue>${flSpeedValue}</FlSpeedValue><FlLevelMeasure>${flLevelMeasure}</FlLevelMeasure><FlLevelValue>${flLevelValue}</FlLevelValue><FlRoute>${this.escapeXml(formData.flRoute || '')}</FlRoute><ADES>${this.escapeXml(formData.ades || '')}</ADES><TotalEET>${formData.totalEet || 0}</TotalEET><ADAltn1>${this.escapeXml(formData.adAltn1 || '')}</ADAltn1><ADAltn2>${this.escapeXml(formData.adAltn2 || '')}</ADAltn2><FlOther>${this.escapeXml(formData.flOther || '')}</FlOther><Endurance>${field19?.endurance || ''}</Endurance><PersonsOnBoard>${field19?.persons || ''}</PersonsOnBoard><Radio>${radio}</Radio><Survival>${survival}</Survival><Jackets>${jackets}</Jackets><DinghiesNumber>${field19?.dinghiesNumber || ''}</DinghiesNumber><DinghiesCapacity>${field19?.dinghiesCapacity || ''}</DinghiesCapacity><DinghiesCover>${field19?.dinghiesCover ? 'true' : 'false'}</DinghiesCover><DinghiesColour>${this.escapeXml(field19?.dinghiesColour || '')}</DinghiesColour><AircraftColour_A>${this.escapeXml(field19?.aircraftColour || '')}</AircraftColour_A><Remarks_N>${this.escapeXml(field19?.remarks || '')}</Remarks_N><PilotInCmd_C>${this.escapeXml(field19?.pilotInCommand || '')}</PilotInCmd_C><AddInfoInstruction></AddInfoInstruction><AddInfoPilottel>${this.escapeXml(formData.pilotTel || '')}</AddInfoPilottel><AddInfoPilotfax></AddInfoPilotfax><AddInfoPilotmail></AddInfoPilotmail><AddInfoSendertel></AddInfoSendertel><AddInfoSenderfax></AddInfoSenderfax><AddInfoSendermail></AddInfoSendermail></mob:FlTplValues><mob:UserSession>${userSession}</mob:UserSession></mob:SaveFlTplRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseSaveTemplateResponse(xmlText);
  }

  private parseSaveTemplateResponse(xml: string): SaveTemplateResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        success: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    let errorMsg = getTagValue('ErrMsg', xml);

    // Check for SOAP fault
    if (!errorMsg) {
      const faultMatch = xml.match(/<(?:SOAP-ENV:)?Fault[^>]*>([\s\S]*?)<\/(?:SOAP-ENV:)?Fault>/i);
      if (faultMatch) {
        errorMsg = getTagValue('faultstring', faultMatch[1]) || 'SOAP Fault';
      }
    }

    // Success response contains InsertedTplId
    const insertedTplId = getTagValue('InsertedTplId', xml);
    const success = !isError && !!insertedTplId;

    // If failed but no error message, include raw response for debugging
    if (!success && !errorMsg) {
      console.log('Save template failed. Raw response:', xml);
      errorMsg = 'Unknown error - check server logs for details';
    }

    return {
      isError,
      success,
      errorMessage: errorMsg || undefined,
      rawResponse: !success ? xml : undefined,
    };
  }

  // Send flight plan to CARO (ATC)
  async sendFlightPlan(
    cookies: string,
    token: string,
    userSession: string,
    formData: FlightPlanFormData
  ): Promise<FlightPlanSubmitResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:SendFplToCaroRequest><mob:FlAttributes><ARCID>${this.escapeXml(formData.arcid)}</ARCID><FlRules>${formData.flRules}</FlRules><FlType>${formData.flType}</FlType><ArcNum>${formData.arcNum || ''}</ArcNum><ArcType>${this.escapeXml(formData.arcType)}</ArcType><WakeTurbulenceCat>${formData.wakeTurbulenceCat}</WakeTurbulenceCat><Equipment>${this.escapeXml(formData.equipment)}</Equipment><ADEP>${this.escapeXml(formData.adep)}</ADEP><EOBDT>${formData.eobdt}</EOBDT><FlSpeed>${this.escapeXml(formData.flSpeed)}</FlSpeed><FlLevel>${this.escapeXml(formData.flLevel)}</FlLevel><FlRoute>${this.escapeXml(formData.flRoute)}</FlRoute><ADES>${this.escapeXml(formData.ades)}</ADES><ADAltn1>${this.escapeXml(formData.adAltn1 || '')}</ADAltn1><ADAltn2>${this.escapeXml(formData.adAltn2 || '')}</ADAltn2><TotalEET>${formData.totalEet}</TotalEET><FlOther>${this.escapeXml(formData.flOther || '')}</FlOther><FlSuplementary>${this.escapeXml(formData.flSuplementary || '')}</FlSuplementary><AddInfoPilottel>${this.escapeXml(formData.pilotTel || '')}</AddInfoPilottel></mob:FlAttributes><mob:UseNMB2B>0</mob:UseNMB2B><mob:UserSession>${userSession}</mob:UserSession></mob:SendFplToCaroRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseSendFlightPlanResponse(xmlText);
  }

  private parseSendFlightPlanResponse(xml: string): FlightPlanSubmitResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        fplIsSent: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const fplIsSent = getTagValue('FplIsSent', xml) === '1';
    const errMsg = getTagValue('ErrMsg', xml);

    return {
      isError,
      fplIsSent,
      errorMessage: errMsg || undefined,
    };
  }

  // Delete a flight plan template
  async deleteTemplate(
    cookies: string,
    token: string,
    userSession: string,
    tplId: number
  ): Promise<DeleteTemplateResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:DeleteFlTplRequest><mob:UserSession>${userSession}</mob:UserSession><mob:TplId>${tplId}</mob:TplId></mob:DeleteFlTplRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseDeleteTemplateResponse(xmlText);
  }

  private parseDeleteTemplateResponse(xml: string): DeleteTemplateResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        success: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const deletedTplId = parseInt(getTagValue('DeletedTplId', xml)) || undefined;
    const errorMsg = getTagValue('ErrMsg', xml);

    return {
      isError,
      success: !isError && !!deletedTplId,
      deletedTplId,
      errorMessage: errorMsg || undefined,
    };
  }

  // Send delay (DLA) message for a flight plan
  async sendDelay(
    cookies: string,
    token: string,
    userSession: string,
    flId: number,
    newEobt: string  // New EOBT time in HHMM format (e.g., "1200")
  ): Promise<FlightPlanActionResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:SendDLARequest><mob:FlId>${flId}</mob:FlId><mob:EobtVal>${newEobt}</mob:EobtVal><mob:UserSession>${userSession}</mob:UserSession></mob:SendDLARequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseActionResponse(xmlText);
  }

  // Send cancel (CNL) message for a flight plan
  async sendCancel(
    cookies: string,
    token: string,
    userSession: string,
    flId: number
  ): Promise<FlightPlanActionResponse> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8" ?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mob="http://mobiltech.sk/"><soapenv:Body><mob:SendCNLRequest><mob:FlId>${flId}</mob:FlId><mob:UserSession>${userSession}</mob:UserSession></mob:SendCNLRequest></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(`${BASE_URL}/ibafProvider.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies,
        'X-AisWeb-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://hbs.ixosystem.eu',
      },
      body: soapRequest,
    });

    const xmlText = await response.text();
    return this.parseActionResponse(xmlText);
  }

  private parseActionResponse(xml: string): FlightPlanActionResponse {
    // Check for session expiry first
    if (isSessionExpiredResponse(xml)) {
      return {
        isError: true,
        sessionExpired: true,
        success: false,
      };
    }

    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<(?:ns1:)?${tag}>([^<]*)</(?:ns1:)?${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const isError = getTagValue('IsError', xml) === '1';
    const msgSent = getTagValue('MsgSent', xml) === '1';
    const errMsg = getTagValue('ErrMsg', xml);

    return {
      isError,
      success: !isError && msgSent,
      msgSent,
      errorMessage: errMsg || undefined,
    };
  }
}

// Singleton instance
export const homebriefingClient = new HomebriefingClient();
