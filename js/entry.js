// @@ Display
let q = document
let owsp_container = ChubML.$('owsp_container')

function clearDisplay() { return owsp_container.innerHTML = '' }
function render(html) { return owsp_container.innerHTML = html }
const globalize = (obj) => globalThis[obj.name] = obj

function importStyle(href = '') {
  return document.head.appendChild(Object.assign(
    document.createElement('link'),
    { href, rel: 'stylesheet', type: 'text/css' }
  ))
}

function importScript(src = '', type = '', async = false, innerHTML = '') {
  return document.head.appendChild(Object.assign(
    document.createElement('script'),
    { src, type, async, innerHTML }
  ))
}

// ---
// @@ Connect Display

const ConnectionDisplay = () => ChubML.parse(`
owsp_connect_body;
  owsp_connect_panel;

    owsp_connect_header;
      h3;
        "Connect to an OWSWSS...";
      small;
        i;
          "Connect to OWSWSS Servers";

    br;

    hr .imini;
    hr .holomini;

    owsp_connect_form;
      code;

        label %for=owsp_curl @:OWS|WSS:;
        input %name=owsp_curl %type=url;
        br;

        label %for=owsp_cport @:WS|PORT:;
        input %name=owsp_cport %type=number;
        br;

        label %for=owsp_cpass @:PASSWD?:;
        input %id=owsp_cpass %name=owsp_cpass;

    br;

    hr .holomini;
    hr .imini;

    // ---

    owsp_connect_options;

      fieldset .holo;
        legend;
          "Encoding";

        label;
          input %type=radio %name=owsp_connect_options_radio %value=raw %checked=true;
            "Raw";

        label;
          input %type=radio %name=owsp_connect_options_radio %value=gm1bp;
            "Bullpress";

    hr .imini;

    owsp_connect_security_radio;

      fieldset .holo;
        legend;
          "Security";

        label;
          input %type=radio %name=owsp_connect_security_radio %value=yes %checked=true;
            "Yes";

        label;
          input %type=radio %name=owsp_connect_security_radio %value=no;
            "No";

    // ---

    hr .holomini;

    // ---

    owsp_buttons;

      fieldset .holo;
        legend;
          "Operation";

        label;
          button %onclick=click_owsp_connect(this);
            "Connect";

        label;
          button %onclick=click_owsp_cancel(this);
            "Cancel";

  owsp_connect_results .center_text @*wrp=p @*wrp=i @*wrp=code;
    owsp_connect_results_body;
`)

const DisconnectButton = () => ChubML.parse(`
owsp_disconnect_button;
  button %onclick=click_owsp_disconnect(this);
    "Disconnect";
`)


class ConnectionDisplayElements {
  /** @type {HTMLElement} Main connection body */
  connect_body = ChubML.$('owsp_connect_body')

  /** @type {HTMLElement} Panel for the connect form */
  connect_panel = ChubML.$('owsp_connect_panel')
  /** @type {HTMLElement} Header for the connect form */
  connect_header = ChubML.$('owsp_connect_header')
  /** @type {HTMLElement} Form for connection inputs */
  connect_form = ChubML.$('owsp_connect_form')

  /** @type {HTMLInputElement} URL input field */
  curl = ChubML.$('[name=owsp_curl]')
  /** @type {HTMLInputElement} Port input field */
  cport = ChubML.$('[name=owsp_cport]')
  /** @type {HTMLInputElement} Password input field */
  cpass = ChubML.$('[name=owsp_cpass]')

  /** @type {HTMLElement} Connection options */
  connect_options = ChubML.$('owsp_connect_options')

  /** @type {HTMLInputElement} Raw encoding option */
  connect_options_raw = ChubML.$('[value=raw]')
  /** @type {HTMLInputElement} Bullpress encoding option */
  connect_options_bullpress = ChubML.$('[value=gm1bp]')

  /** @type {HTMLElement} Security options */
  connect_security_radio = ChubML.$('owsp_connect_security_radio')

  /** @type {HTMLInputElement} Yes security option */
  connect_security_yes = ChubML.$('[value=yes]')
  /** @type {HTMLInputElement} No security option */
  connect_security_no = ChubML.$('[value=no]')

  /** @type {HTMLElement} Buttons for the connect form */
  buttons = ChubML.$('owsp_buttons')

  /** @type {HTMLElement} Results of the connection */
  connect_results = ChubML.$('owsp_connect_results')
  /** @type {HTMLElement} Body of the connection results */
  connect_results_body = ChubML.$('owsp_connect_results_body')
}

function makeConnectionDisplay() {
  let page = ConnectionDisplay()
  owsp_container.innerHTML += page
  return new ConnectionDisplayElements
}

// ---

class ConnectionDisplayAPI extends ConnectionDisplayElements {
  curl = this.curl.value
  cport = this.cport.value
  cpass = this.cpass.value

  out = this.connect_results_body

  options = {
    raw: !!this.connect_options_raw.checked,
    bullpress: !!this.connect_options_bullpress.checked
  }

  authenticated = false;

  owsp_safeAction(action) {
    return this.authenticated ? action() : this.fatal('Not authenticated')
  }

  AUTH_TIMEOUT_TIME = 5 * 1000;

  failAuth = (e) => this.fatal(`Failed to authenticate: ${e?.message || e}`)

  display(msg) { this.out.innerHTML += msg + '<br>' }

  clr() { this.out.innerHTML = '' }

  clrpr(msg) { this.clr(), this.display(msg) }

  packMsg({ data, type = 'plain' }) { return JSON.stringify({ type, data }) }

  unpackMsg(msg) { return (({ type, data }) => ({ type, data }))(JSON.parse(msg)) }

  transfer = (type, data) => ws.send(this.packMsg({ type, data }))

  timeout = (call, until, _t = setTimeout(call, until)) => () => clearTimeout(_t)

  once = (type, call) => {
    function remove() { return ws.removeEventListener(type, ecb) }
    function ecb(e) { return (call(e), remove()) }
    ws.addEventListener(type, ecb)
    return remove
  }

  awaitOnce = (eventType, timeoutMillis = -1) => new Promise((resolve, reject) => {
    const onTimeout = () => (clearListeners(), reject(new Error('Timeout')))
    const timer = timeoutMillis >= 0 ? timeout(onTimeout, timeoutMillis) : () => { }
    const clearListeners = this.once(eventType, (event) => (timer(), resolve(event)))
  })

  #j = (cb) => { try { cb() } catch (e) { console.error(e) } }
  fatal = (errorMessage) => {
    this.#j(() => this.clrpr(errorMessage))
    this.#j(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      this.transfer('client_error', { error: errorMessage });
      console.error(`Client error: `, errorMessage)
      ws.close();
    })
  }
}

globalize(function click_owsp_connect(button) {

  const ca = new ConnectionDisplayAPI

  let proto;
  switch (true) {
    default:
    case ca.connect_security_yes.checked:
      proto = `wss`
      break
    case ca.connect_security_no.checked:
      proto = `ws`
      break
  }

  let tempURL = `${proto}://${ca.curl}`
  let nurl = new URL(tempURL)
  ca.cport && (nurl.port = ca.cport)

  let urlTemplate = nurl.toString()
  let ws = new WebSocket(urlTemplate);

  // ---
  // @@ WS

  ca.clrpr(`Connecting to ${urlTemplate}...`)

  ws.onopen = async (event) => {
    console.log('Connection opened: ', event)

    const handleConnect = () => {
      authenticated = true;
      ca.transfer('client_ready', {});
      ca.clrpr(`Connected to ${urlTemplate}`)
    }

    if (!ca.cpass) handleConnect()
    // If passworded, send password, then wait for confirmation.
    // Expects { data: { type: 'ok' }, type: 'auth' }
    else ca.transfer('auth', { password: ca.cpass }), await ca.awaitOnce('auth', ca.AUTH_TIMEOUT_TIME)
      .catch(ca.failAuth)
      .then(e => {
        if (e?.data && ca.unpackMsg(e.data)?.type === 'ok')
          handleConnect()
        else
          ca.failAuth(`Authentication failed, Expects { data: { type: 'ok' }, type: 'auth' }`)
      })
  };

  ws.onclose = (event) => {
    console.warn('WebSocket close observed: ', event);
    ca.display(`Disconnected from ${urlTemplate} `)
  };

  ws.onmessage = (event) => {
    console.log('WebSocket message received: ', event);
    ca.display(`Received message: ${event.data} `)

    try { var { data, type } = ca.unpackMsg(event.data) }
    catch (e) { return ca.fatal(`Failed to unpack message: ${e}`) }

    try {
      switch (type) {
        // { type: html, data: '...' }
        case 'html': return render(data)
        // { type: js, data: '...' }
        case 'js': return eval(data)
        // { type: script, data: { src, type, async, innerHTML } }
        case 'script': return importScript(data.src, data.type, data.async, data.innerHTML)
        // { type: script, data: { href } }
        case 'style': return importStyle(data.href)
      }
    } catch (e) { return ca.fatal(`Failed to handle message: ${e}`) }
  };

  ws.onerror = (event) => {
    console.error('WebSocket error observed: ', event);
    ca.display(`Error: ${event.data} `)
  };

  // ---
  // @@ On Leave
  onbeforeunload = () => just(ws.close())
})

globalize(function click_owsp_cancel(button) {
  clearDisplay()
})

// ---
// @@ Backdrop Display

/* 
.----------------.-----------------------.
|                |                       |
|                |                       |
|                |                       |
:----------------:                       |
|                |                       |
|                |                       |
|                |                       |
|                |                       |
'----------------'-----------------------'
*/

const BackdropDisplay = () => ChubML.parse(`
owsp_backdrop_container;

  owsp_backdrop_left;
    owsp_backdrop_header;
      h1;
        owsp_backdrop_header_title;
      section;
        small;
          owsp_backdrop_header_subtitle;
        br;
        owsp_backdrop_header_body;

    owsp_backdrop_footer;
      small;
        owsp_backdrop_footer_subtitle;
      br;
      owsp_backdrop_footer_body;

  owsp_backdrop_right;
    owsp_backdrop_right_body;
`)

function makeBackdropDisplay() {
  let page = BackdropDisplay()
  owsp_container.innerHTML += page
  return new BackdropDisplayElements
}

class BackdropDisplayElements {
  /** @type {HTMLElement} Main backdrop container */
  backdrop_container = ChubML.$('owsp_backdrop_container')

  /** @type {HTMLElement} Left side of the backdrop */
  backdrop_left = ChubML.$('owsp_backdrop_left')

  /** @type {HTMLElement} Header of the backdrop */
  backdrop_header = ChubML.$('owsp_backdrop_header')
  /** @type {HTMLElement} Title of the backdrop */
  backdrop_header_title = ChubML.$('owsp_backdrop_header_title')
  /** @type {HTMLElement} Subtitle of the backdrop */
  backdrop_header_subtitle = ChubML.$('owsp_backdrop_header_subtitle')
  /** @type {HTMLElement} Section body of the backdrop */
  backdrop_header_body = ChubML.$('owsp_backdrop_header_body')

  /** @type {HTMLElement} Footer of the backdrop */
  backdrop_footer = ChubML.$('owsp_backdrop_footer')
  /** @type {HTMLElement} Section subtitle of the backdrop */
  backdrop_footer_subtitle = ChubML.$('owsp_backdrop_footer_subtitle')
  /** @type {HTMLElement} Section body of the backdrop */
  backdrop_footer_body = ChubML.$('owsp_backdrop_footer_body')

  /** @type {HTMLElement} Right side of the backdrop */
  backdrop_right = ChubML.$('owsp_backdrop_right')

  /** @type {HTMLElement} Body of the backdrop */
  backdrop_right_body = ChubML.$('owsp_backdrop_right_body')
}

// ---

// @@ Start
{
  var connectDisplay
    = makeConnectionDisplay()
  var backdropDisplay
  // = makeBackdropDisplay()
}