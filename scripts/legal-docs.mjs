/* The legal documents, as data.
 *
 * Written for an operator assumed to be an individual established in Western
 * Australia, publishing a free, account-less static site. Australian
 * Commonwealth and WA law is applied; anything that depends on facts only the
 * operator holds is a [PLACEHOLDER].
 *
 * Do not "improve" this by adding claims: no accreditation, no licence to
 * third-party content, no safe-harbour protection that has not been earned,
 * and no exclusion of the consumer guarantees in the Australian Consumer Law.
 */

const OPERATOR = '[OPERATOR LEGAL NAME]';
const ABN = '[ABN, if any]';
const ADDRESS = '[POSTAL ADDRESS FOR LEGAL NOTICES]';
const EMAIL = 'nuxxzul@gmail.com';

export const DOCS = [
  {
    slug: '',
    label: 'Legal centre',
    kicker: 'Legal',
    title: 'Legal centre | ZenouMath',
    desc: 'Every document that governs use of ZenouMath: terms, privacy, acceptable use, copyright, takedown, disclaimer, liability and contact.',
    h1: 'Legal centre',
    intro: `Eight documents, one page each, written to describe what this site actually does. Version 2026-11-07, last updated 7 November 2026.`,
    toc: [
      ['documents', 'The documents'],
      ['roles', 'Who does what'],
      ['placeholders', 'What still needs the operator'],
      ['review', 'What needs legal review'],
    ],
    body: `
    <h2 id="documents">The documents</h2>
    <table class="legal-table">
      <thead><tr><th>Document</th><th>What it covers</th></tr></thead>
      <tbody>
        <tr><td><a href="/legal/terms">Terms of Service</a></td><td>The contract between you and the operator: what you may do here, what the site promises (very little), and which law applies.</td></tr>
        <tr><td><a href="/legal/privacy">Privacy Policy</a></td><td>What is collected, what is not, which third parties can see your browser, and how to exercise your rights under the Privacy Act 1988 (Cth).</td></tr>
        <tr><td><a href="/legal/acceptable-use">Acceptable Use Policy</a></td><td>The conduct that gets access withdrawn, including the specific rules for the reference desk and its proxy doorway.</td></tr>
        <tr><td><a href="/legal/copyright">Copyright Policy</a></td><td>Who owns what here, what the site claims and does not claim, and where the boundaries sit.</td></tr>
        <tr><td><a href="/legal/takedown">Takedown process</a></td><td>How to report material you own and have it removed, and how a counter-notice works.</td></tr>
        <tr><td><a href="/legal/disclaimer">Disclaimer</a></td><td>The limits of a study aid: accuracy, availability, no advice, no affiliation with any school.</td></tr>
        <tr><td><a href="/legal/liability">Limitation of Liability</a></td><td>How far the operator is responsible for loss, and the rights that cannot be excluded.</td></tr>
        <tr><td><a href="/legal/contact">Contact</a></td><td>Where to send legal, privacy and copyright correspondence, and what to include.</td></tr>
      </tbody>
    </table>

    <h2 id="roles">Who does what</h2>
    <p>Three different parties are involved every time you open a lecture page, and the documents keep them separate on purpose:</p>
    <ul>
      <li><strong>The operator of ZenouMath</strong> — publishes the pages, the practice catalogue and the directory. That is ${OPERATOR}, whose details are in the <a href="/legal/contact">contact page</a>.</li>
      <li><strong>Metadata providers</strong> — TMDB supplies film and television titles, descriptions, artwork and ratings. TMDB is not affiliated with this site and does not endorse it.</li>
      <li><strong>Hosts and players</strong> — the third-party sites that actually hold and stream video, host a game build, or run an AI assistant. The operator does not own, licence, control or re-host any of it.</li>
    </ul>
    <p>Practice sets are embedded from their publisher's own build (HoodaMath, CrazyGames, Scratch, or the developer's own server). Audio plays through Spotify and SoundCloud's official embeds. When you press play, your browser talks to that company directly.</p>

    <h2 id="placeholders">What still needs the operator</h2>
    <div class="legal-callout">
      <strong>These are not filled in, and they cannot be filled in from the codebase:</strong>
      <ul>
        <li>Legal name of the operator: <code>${OPERATOR}</code></li>
        <li>Australian Business Number, if one is held: <code>${ABN}</code></li>
        <li>Postal address for legal notices: <code>${ADDRESS}</code></li>
        <li>Log retention period in the privacy policy: <code>[RETENTION PERIOD]</code></li>
        <li>Whether the operator is an individual, a sole trader or a company: <code>[ENTITY TYPE]</code></li>
        <li>Whether a nominated copyright agent has been appointed: <code>[YES / NO]</code></li>
      </ul>
    </div>
    <p>Nothing on this site should be read as claiming that any of those have been supplied.</p>

    <h2 id="review">What needs legal review</h2>
    <p>These documents were drafted by reading the site's own code and configuration. They are not the product of legal advice, and four points genuinely need a lawyer admitted in Western Australia before you rely on them:</p>
    <ol>
      <li><strong>Whether the operator is an "APP entity".</strong> The Privacy Act 1988 (Cth) applies to most businesses with turnover above the threshold, and to some below it. Which side this falls on is a question of fact, not of wording.</li>
      <li><strong>Whether the Copyright Act safe harbour applies.</strong> Section 115A of the Copyright Act 1968 (Cth) gives qualifying service providers protection against authorisation liability, but only if the conditions are met — including a nominated agent and a compliant takedown scheme. The site does not currently assert that protection, and this document does not pretend it does.</li>
      <li><strong>Whether linking and framing is authorisation of infringement.</strong> Australian law on authorisation is fact-specific. The site's position is that it provides links and frames only, that it holds no files, and that it takes notices seriously — but the boundary is a matter for advice, not a disclaimer.</li>
      <li><strong>Whether the liability cap is enforceable against a consumer.</strong> The Australian Consumer Law voids terms that attempt to exclude guarantees it imposes. The cap in the <a href="/legal/liability">liability page</a> is drafted to sit inside that limit, not around it.</li>
    </ol>
    <div class="legal-callout">
      <strong>A disclaimer does not create immunity.</strong> Nothing in these pages removes liability for fraud, for misleading conduct under the Australian Consumer Law, or for anything else the law does not allow to be excluded. An accepted checkbox is evidence of a decision; it is not a shield.
    </div>

    <h2 id="version">Version and acceptance</h2>
    <p>The first-visit agreement records two things in your browser: this version string and the date you accepted. No name, no email address, no identifier. Bumping the version asks you once more; accepting again overwrites the record. You can re-open the agreement at any time from the footer link <em>Review the use agreement</em>.</p>
    `,
  },

  {
    slug: 'terms',
    label: 'Terms of Service',
    kicker: 'Legal · Terms',
    title: 'Terms of Service | ZenouMath',
    desc: 'The agreement between you and the operator of ZenouMath: permitted use, the site’s (limited) promises, third-party services, and governing law.',
    h1: 'Terms of Service',
    intro: 'These terms govern your use of zenoumath.space. By accepting the first-visit agreement or continuing to use the site, you agree to them.',
    toc: [
      ['operator', 'Who operates this site'],
      ['what', 'What ZenouMath is'],
      ['agree', 'Agreeing to these terms'],
      ['use', 'Permitted use'],
      ['third', 'Third-party sites and players'],
      ['accounts', 'No accounts'],
      ['availability', 'Availability and changes'],
      ['ip', 'Intellectual property'],
      ['liability', 'Liability'],
      ['ends', 'When access ends'],
      ['law', 'Governing law'],
      ['changes', 'Changes to these terms'],
    ],
    body: `
    <h2 id="operator">1. Who operates this site</h2>
    <p>ZenouMath is published by ${OPERATOR} (<code>${ABN}</code>), of <code>${ADDRESS}</code>. In these terms, "we", "us" and "the operator" mean that person or entity, and "you" means the visitor.</p>
    <p>Legal, privacy and copyright correspondence goes to the addresses on the <a href="/legal/contact">contact page</a>. Ordinary corrections can go to <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>

    <h2 id="what">2. What ZenouMath is</h2>
    <p>ZenouMath is a free, account-less website with four parts:</p>
    <ul>
      <li><strong>Practice</strong> — a catalogue of browser games, each embedded from its publisher's own build. The games are real games; they are presented here as practice and warm-up material, not as a curriculum.</li>
      <li><strong>Lecture hall</strong> — film and television <em>metadata</em> supplied by TMDB, plus links to third-party players. The site holds no video files and no stream URLs.</li>
      <li><strong>Reference desk and tutor room</strong> — a framed browser and a directory of third-party sites and AI tools. The frame shows their page, not a copy of it.</li>
      <li><strong>Audio and shelf</strong> — official Spotify and SoundCloud embeds, and a local library stored in your browser.</li>
    </ul>
    <div class="legal-callout">
      <strong>ZenouMath is not a school.</strong> It is not accredited, it does not award qualifications, and it is not affiliated with, endorsed by or acting on behalf of any school, university, education department or examination board. Nothing here is a substitute for work set by your own institution, and nothing here should be cited as an academic source.
    </div>

    <h2 id="agree">3. Agreeing to these terms</h2>
    <p>On your first visit, a gate asks you to read a summary and actively accept these terms and the <a href="/legal/privacy">Privacy Policy</a>. No box is pre-ticked and visiting alone is not treated as acceptance — until you accept, the site's content stays hidden.</p>
    <p>You may decline. Declining stores nothing and shows no content. If you accept, the version and date are recorded in your browser's <code>localStorage</code>; nothing is sent to a server.</p>

    <h2 id="use">4. Permitted use</h2>
    <p>You may use ZenouMath for personal, non-commercial study and reference. The full list of prohibited conduct is in the <a href="/legal/acceptable-use">Acceptable Use Policy</a>, which forms part of these terms. In short, you must not:</p>
    <ul>
      <li>break the law where you are, including copyright law;</li>
      <li>use the reference desk or its doorway to reach systems you are not authorised to access;</li>
      <li>disrupt the site or exceed reasonable request rates against it;</li>
      <li>resell access to it, or present it as your own product;</li>
      <li>use it to harass, defraud or harm another person.</li>
    </ul>

    <h2 id="third">5. Third-party sites and players</h2>
    <p>Most of what you watch or play on this site is served by somebody else, under their terms, not ours. When you open a third-party player, embed or assistant, that company's own terms and privacy policy apply, and they may set their own cookies or storage.</p>
    <p>We do not own, license, host, verify the legality of, or take responsibility for third-party content. Availability is checked when a source is listed and re-checked periodically, but a source that answered last week may be gone today. A source is never shown on the assumption that it works.</p>

    <h2 id="accounts">6. No accounts</h2>
    <p>There is no sign-in and no user account. Settings, saved items, ratings, notes and the acceptance record live in your own browser. Clearing site data deletes them permanently; we cannot restore them because we never had them.</p>

    <h2 id="availability">7. Availability and changes</h2>
    <p>The site is provided free of charge and as-is. We may change it, restrict a part of it, or withdraw it entirely at any time, and we do not guarantee uninterrupted or error-free operation. We may suspend access for anyone who breaches these terms.</p>

    <h2 id="ip">8. Intellectual property</h2>
    <p>The site's own code, layout and copy belong to the operator. Game builds, film artwork, film metadata, video, audio, trademarks and assistant interfaces belong to their respective owners. The site claims no ownership or licence over any of it. The full position, including TMDB's attribution requirements, is in the <a href="/legal/copyright">Copyright Policy</a>.</p>

    <h2 id="liability">9. Liability</h2>
    <p>Your use of the site is at your own risk. The limits of the operator's responsibility are set out in full in the <a href="/legal/liability">Limitation of Liability</a> page, which forms part of these terms.</p>
    <div class="legal-callout">
      <strong>Nothing in these terms excludes a right you have under the Australian Consumer Law</strong> that cannot lawfully be excluded, including the consumer guarantees in sections 51 to 59 of the Competition and Consumer Act 2010 (Cth) where they apply.
    </div>

    <h2 id="ends">10. When access ends</h2>
    <p>You may stop using the site at any time; there is nothing to cancel. We may withdraw access, including by blocking a network or an individual, if these terms are breached. Sections that by their nature survive — intellectual property, liability, and governing law — continue to apply.</p>

    <h2 id="law">11. Governing law</h2>
    <p>These terms are governed by the laws of Western Australia and, where applicable, the Commonwealth of Australia. You and the operator submit to the non-exclusive jurisdiction of the courts of Western Australia. If you are a consumer resident elsewhere in Australia, this does not remove any right you have to bring a claim in your own State or Territory.</p>
    <p>If any provision is found unenforceable, it is severed and the rest continues to operate.</p>

    <h2 id="changes">12. Changes to these terms</h2>
    <p>These terms carry a version number, currently <code>2026-11-07</code>. A material change bumps that number and the first-visit gate asks you to accept again. Non-material corrections — a typo, a broken link — do not. Continuing to use the site after a version change you have not accepted is not treated as acceptance of it.</p>
    `,
  },

  {
    slug: 'privacy',
    label: 'Privacy Policy',
    kicker: 'Legal · Privacy',
    title: 'Privacy Policy | ZenouMath',
    desc: 'What ZenouMath collects, what it deliberately does not collect, which third parties can see your browser, and how to exercise your rights under the Privacy Act 1988 (Cth).',
    h1: 'Privacy Policy',
    intro: 'ZenouMath has no accounts and no analytics. This page is the complete list of what is collected anyway, and by whom.',
    toc: [
      ['responsible', 'Who is responsible'],
      ['not', 'What is not collected'],
      ['collected', 'What is collected'],
      ['local', 'What stays in your browser'],
      ['third', 'Third parties your browser contacts'],
      ['cookies', 'Cookies'],
      ['why', 'Why the little we hold is held'],
      ['disclosure', 'Disclosure and overseas storage'],
      ['security', 'Security'],
      ['rights', 'Your rights and complaints'],
      ['children', 'Children'],
      ['changes', 'Changes'],
    ],
    body: `
    <h2 id="responsible">1. Who is responsible</h2>
    <p>The operator named in the <a href="/legal/contact">contact page</a> is responsible for the small amount of personal information described here. Whether the operator is an "APP entity" bound by the Australian Privacy Principles is a question of fact and law — see <a href="/legal#review">what needs legal review</a>. This policy is written to the standard of the Privacy Act 1988 (Cth) and the Australian Privacy Principles, whether or not that Act formally applies.</p>

    <h2 id="not">2. What is not collected</h2>
    <p>This is the shortest list to trust, so it comes first:</p>
    <ul>
      <li><strong>No accounts.</strong> No name, email address, password or profile.</li>
      <li><strong>No advertising or analytics trackers.</strong> No Google Analytics, no Meta pixel, no session recording, no fingerprinting script.</li>
      <li><strong>No first-party cookies.</strong> The site sets none of its own.</li>
      <li><strong>No server-side viewing history.</strong> What you watch, play or save is not recorded on the server.</li>
      <li><strong>No selling or renting of personal information.</strong> Ever, to anyone.</li>
    </ul>

    <h2 id="collected">3. What is collected</h2>
    <p>Two things, both ordinary:</p>
    <h3>Server request logs</h3>
    <p>The web server that serves the pages records ordinary request metadata: the requested path, the time, the HTTP status, the user-agent string your browser sends, and the IP address the request came from. These logs exist to keep the site up and to detect abuse. They are retained for <code>[RETENTION PERIOD]</code> and then deleted or rotated.</p>
    <h3>API usage counters</h3>
    <p>The optional metadata API in front of TMDB keeps in-memory counters (requests served, cache hits and misses) and a keyed cache of upstream responses. These are operational statistics, not profiles: there is no per-visitor identifier attached to them and they are cleared when the process restarts.</p>

    <h2 id="local">4. What stays in your browser</h2>
    <p>These keys live in <code>localStorage</code> on your device. They never reach a server, and clearing site data deletes them.</p>
    <table class="legal-table">
      <thead><tr><th>Key</th><th>Holds</th></tr></thead>
      <tbody>
        <tr><td><code>zenoumath.consent</code></td><td>The agreement version you accepted and the date you accepted it. Nothing else.</td></tr>
        <tr><td><code>zenou_prefs</code></td><td>Appearance: theme, glow, radius, density, motion, background, accent hue.</td></tr>
        <tr><td><code>zenou_lib</code> and related</td><td>Favourites, playlists, ratings, notes, recently opened items, hidden games.</td></tr>
        <tr><td>Doorway templates</td><td>Proxy address templates you add yourself. They stay local because public proxy instances are short-lived.</td></tr>
        <tr><td><code>__gsuite_theme_pref_v2</code></td><td>A cached copy of the doorway menu, so a dead mirror does not leave a blank door.</td></tr>
      </tbody>
    </table>
    <p>Because none of it is transmitted, the operator cannot read it, export it or restore it for you. That cuts both ways: it is private, and it is not backed up.</p>

    <h2 id="third">5. Third parties your browser contacts</h2>
    <p>This is the part most privacy policies bury. Wherever you go on this site, your browser may talk directly to the following companies, and they will see your IP address and user-agent at minimum:</p>
    <table class="legal-table">
      <thead><tr><th>Service</th><th>When</th><th>What they can see</th></tr></thead>
      <tbody>
        <tr><td>TMDB (<code>image.tmdb.org</code>)</td><td>Any lecture page with artwork</td><td>Your IP and which images you loaded. Metadata text is proxied through our server; images are not.</td></tr>
        <tr><td>Google Fonts</td><td>Every page</td><td>Your IP and user-agent when the font file is requested.</td></tr>
        <tr><td>YouTube</td><td>Media shelf playback</td><td>Full YouTube cookie and tracking behaviour, exactly as on youtube.com.</td></tr>
        <tr><td>Spotify, SoundCloud</td><td>Audio bench playback</td><td>Their own embed analytics and cookies.</td></tr>
        <tr><td>TikTok, Instagram, Discord</td><td>Only if you open one of those embeds</td><td>Their own tracking, subject to their policies.</td></tr>
        <tr><td>Game publishers (CrazyGames, Scratch, HoodaMath, developers)</td><td>When a practice set loads</td><td>Their own analytics and whatever advertising their build includes. The site does not control it.</td></tr>
        <tr><td>Third-party players and AI assistants</td><td>When you open one</td><td>Their own policies apply in full, including their advertising and account systems.</td></tr>
        <tr><td>Proxy doorway (Magma)</td><td>Only if you choose to use it</td><td>Every request passes through that third party's server. It can see the addresses you visit, and its own operator's privacy practices govern. Nothing on this site can change that.</td></tr>
      </tbody>
    </table>
    <p>We cannot delete data held by those companies, and we cannot tell them to. Contact them directly, under their own policies.</p>

    <h2 id="cookies">6. Cookies</h2>
    <p>The site sets no first-party cookies. Third-party embeds on a page — YouTube, Spotify, game builds — may set their own as soon as they load. If you want to block them, block third-party cookies in your browser, or use a content blocker; the site continues to work without them, though embeds may not.</p>

    <h2 id="why">7. Why the little we hold is held</h2>
    <ul>
      <li><strong>Server logs</strong> — to serve the site, diagnose faults and resist abuse (APP 3, directly related to operation).</li>
      <li><strong>Acceptance record</strong> — to keep the agreement and to avoid asking you again (stored on your device, not collected).</li>
      <li><strong>API counters</strong> — to keep upstream request volume inside TMDB's limits so the site stays available.</li>
    </ul>

    <h2 id="disclosure">8. Disclosure and overseas storage</h2>
    <p>Personal information is not sold, rented or shared for marketing. It may be disclosed where the law compels it, or to a hosting provider strictly as part of serving the site. Logs may be held on infrastructure located outside Australia, most likely the United States or the European Union, depending on where the site is hosted. The countries involved are <code>[HOSTING LOCATIONS]</code> and should be confirmed against the host actually used.</p>

    <h2 id="security">9. Security</h2>
    <p>The site is served over HTTPS. There is no account database to breach because there are no accounts. That reduces risk; it does not eliminate it. No system is perfectly secure, and no guarantee of security is given.</p>

    <h2 id="rights">10. Your rights and complaints</h2>
    <p>Under the Australian Privacy Principles you may ask what personal information is held about you, ask for it to be corrected, and ask for a correction to be associated with the record. In practice, almost everything is in your own browser — but the request can still be made.</p>
    <p>Send a request to the privacy address on the <a href="/legal/contact">contact page</a>. We will respond within a reasonable period, ordinarily 30 days. If you are not satisfied with the response, you may complain to the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" rel="noopener">oaic.gov.au</a>.</p>

    <h2 id="children">11. Children</h2>
    <p>The site is not directed at children under 13 and does not knowingly collect personal information from anyone. It has no registration, so it could not collect a child's details even if it wanted to. Where the site is used by a student, local school policy on acceptable use is a matter between the student and the school.</p>

    <h2 id="changes">12. Changes</h2>
    <p>This policy carries the site's agreement version, currently <code>2026-11-07</code>. A material change bumps it and the first-visit gate asks again. The date at the foot of this page records the last edit.</p>
    `,
  },

  {
    slug: 'acceptable-use',
    label: 'Acceptable Use',
    kicker: 'Legal · Acceptable use',
    title: 'Acceptable Use Policy | ZenouMath',
    desc: 'The conduct that is not permitted on ZenouMath, including specific rules for the reference desk, the proxy doorway and automated requests.',
    h1: 'Acceptable Use Policy',
    intro: 'What you may not do here, in plain terms. This policy is part of the Terms of Service.',
    toc: [
      ['general', 'General prohibitions'],
      ['desk', 'Reference desk and doorway'],
      ['automated', 'Automated access'],
      ['content', 'Content you send us'],
      ['consequences', 'Consequences'],
      ['report', 'Reporting misuse'],
    ],
    body: `
    <h2 id="general">1. General prohibitions</h2>
    <p>Do not use ZenouMath to:</p>
    <ul>
      <li>break any law that applies to you, including copyright, privacy, defamation and computer-misuse law;</li>
      <li>harass, threaten, stalk, defame or defraud any person;</li>
      <li>distribute malware or use the site to deliver it;</li>
      <li>infringe another person's intellectual property;</li>
      <li>interfere with the site's operation, or attempt to gain access to it beyond the pages it publishes;</li>
      <li>impersonate the operator or present the site as your own product;</li>
      <li>resell, sublicense or meter access to the site.</li>
    </ul>

    <h2 id="desk">2. Reference desk and doorway</h2>
    <p>The reference desk frames another site's page in a sandboxed box. The doorway is a separate third-party proxy. Both are ordinary tools that people use for ordinary reasons — reading a page that will not load, checking how a site behaves, reaching research behind an inaccessible network. Both can also be misused, so the rules are explicit:</p>
    <ul>
      <li>Do not use either to access a system you are not authorised to access, or to evade an access control you are lawfully subject to.</li>
      <li>Do not use either to log into an account you do not own, or to bypass a paid barrier you have not paid for.</li>
      <li>Do not use either to reach illegal content of any kind.</li>
      <li>Do not use either to send traffic that would be unlawful if sent directly.</li>
      <li>If you are using a school, employer or library network, their acceptable-use rules apply to you in addition to these. The site cannot grant you permission their administrator has withheld.</li>
    </ul>
    <div class="legal-callout">
      <strong>The operator does not control the proxy.</strong> It is a third-party service with its own operator and its own rules. Your traffic passes through it and is visible to it. Anything you do through it is your responsibility and theirs, not this site's.
    </div>

    <h2 id="automated">3. Automated access</h2>
    <p>Reasonable automated use of the public API is fine — it is cached for exactly that reason. Not fine: scraping at a rate that degrades service for others, circumventing the cache to multiply upstream requests, or hammering the metadata API to exhaust a shared rate limit. If a script causes upstream throttling, it will be blocked.</p>

    <h2 id="content">4. Content you send us</h2>
    <p>Corrections, takedown notices and reports are welcome and read. Do not send confidential material you are not entitled to disclose. By sending a notice, you confirm the information in it is accurate and that you are the rights holder or authorised to act for them — a false notice can itself be actionable.</p>

    <h2 id="consequences">5. Consequences</h2>
    <p>A breach may result in the site restricting or blocking access, removing a listing, or referring the matter to a hosting provider or a relevant authority. Because there are no accounts, a block is applied at the network level and may affect other users behind the same address; the operator will try to keep that proportionate.</p>

    <h2 id="report">6. Reporting misuse</h2>
    <p>Report abuse, a broken or hijacked listing, or a doorway that has been repurposed to something illegal through the <a href="/legal/contact">contact page</a>. Include the URL and what you saw; a screenshot helps.</p>
    `,
  },

  {
    slug: 'copyright',
    label: 'Copyright Policy',
    kicker: 'Legal · Copyright',
    title: 'Copyright Policy | ZenouMath',
    desc: 'What ZenouMath owns, what it does not, how third-party metadata and marks are used, and where the operator’s copyright position actually sits.',
    h1: 'Copyright Policy',
    intro: 'Who owns what, what this site claims, and what it deliberately does not claim.',
    toc: [
      ['ours', 'What the operator owns'],
      ['notours', 'What the operator does not own'],
      ['metadata', 'Metadata and attribution'],
      ['linked', 'Linked and framed material'],
      ['safeharbour', 'Safe harbour: what is not claimed'],
      ['marks', 'Trade marks'],
      ['moral', 'Moral rights'],
    ],
    body: `
    <h2 id="ours">1. What the operator owns</h2>
    <p>The site's own source code, page layout, original copy and the visual design belong to the operator. You may read them, learn from them and quote short passages with attribution. You may not republish the site wholesale, sell it, or present it as your own.</p>

    <h2 id="notours">2. What the operator does not own</h2>
    <p>The operator owns no film, television programme, video stream, audio recording, game build, game asset, character, logo or trade mark displayed on or through this site. Not one frame.</p>
    <div class="legal-callout">
      <strong>No licence is claimed over third-party content.</strong> Practice sets load from their publisher's own build. Audio plays through Spotify and SoundCloud's official embeds. Lecture pages frame other operators' players. Every one of those belongs to somebody else and is governed by their terms.
    </div>

    <h2 id="metadata">3. Metadata and attribution</h2>
    <p>Film and television titles, synopses, cast lists, ratings and artwork come from TMDB. Their use is subject to TMDB's own terms, and the required attribution is displayed wherever that data appears:</p>
    <div class="legal-callout">
      <strong>This product uses the TMDB API but is not endorsed or certified by TMDB.</strong>
    </div>
    <p>Metadata is factual description, not the work itself. Where metadata is wrong, the fix is a correction request through the <a href="/legal/contact">contact page</a>, and it will be passed upstream where possible.</p>

    <h2 id="linked">4. Linked and framed material</h2>
    <p>The site provides links to, and frames of, pages hosted by others. Framing shows the third party's own page in a box; it does not copy, cache, transcode or re-host it. The site holds no media files and no stream addresses, and it does not circumvent a paywall, a login or a geographic restriction set by a rights holder.</p>
    <p>Where a source is listed in the directory, the listing records whether that host allows framing and when it was last checked. A listing is not a statement that the host's content is licensed in your country — that is between you, the host and the rights holder.</p>

    <h2 id="safeharbour">5. Safe harbour: what is not claimed</h2>
    <p>The Copyright Act 1968 (Cth) provides a safe harbour scheme for qualifying service providers in section 115A. Qualifying requires conditions — a nominated agent, a compliant takedown procedure, and more — and the operator has not asserted that those conditions are satisfied.</p>
    <div class="legal-callout">
      <strong>This site does not claim the section 115A safe harbour.</strong> It does operate a takedown process and it does act on valid notices, promptly and in good faith. But a process is not the same as a statutory protection, and this page will not pretend otherwise.
    </div>
    <p>The <a href="/legal/takedown">takedown process</a> explains exactly how to send a notice.</p>

    <h2 id="marks">6. Trade marks</h2>
    <p>Company and product names — TMDB, YouTube, Spotify, SoundCloud, TikTok, Instagram, Discord, CrazyGames, Scratch, HoodaMath, Minecraft, and the rest — are trade marks of their owners. They appear here to identify the service being linked or described. Their appearance is not sponsorship, endorsement or affiliation.</p>

    <h2 id="moral">7. Moral rights</h2>
    <p>Creators hold moral rights in their work under Part IX of the Copyright Act. Nothing on this site is intended to attribute a work to the wrong person or to treat it in a derogatory way. Where a game, build or asset is credited, the credit names its creator; if a credit is missing or wrong, say so and it will be corrected.</p>
    `,
  },

  {
    slug: 'takedown',
    label: 'Takedown process',
    kicker: 'Legal · Takedown',
    title: 'Copyright takedown process | ZenouMath',
    desc: 'How to send a copyright notice to ZenouMath, what it must contain, what happens next, and how a counter-notice works.',
    h1: 'Copyright takedown process',
    intro: 'A working process, not a decorative one. Send a compliant notice and the listing or frame comes down while the claim is assessed.',
    toc: [
      ['scope', 'What can actually be removed'],
      ['notice', 'Sending a notice'],
      ['contents', 'What a notice must contain'],
      ['after', 'What happens next'],
      ['counter', 'Counter-notice'],
      ['repeat', 'Repeat infringement'],
      ['false', 'False notices'],
      ['dmca', 'If you are in the United States'],
    ],
    body: `
    <h2 id="scope">1. What can actually be removed</h2>
    <p>Be clear about what this site can do, because a notice that asks for the impossible wastes everybody's time:</p>
    <ul>
      <li><strong>A listing can be removed.</strong> Any entry in the source directory, the lecture rails or the tutor room can be taken down from this site.</li>
      <li><strong>A frame can be removed.</strong> The site can stop embedding a host.</li>
      <li><strong>A game embed can be removed.</strong> The catalogue entry and the embed can go.</li>
      <li><strong>The content itself cannot be removed by this site</strong>, because it does not host it. If the material sits on a third party's server, the notice has to go to that host, or to the host's own designated agent. This site can only stop pointing at it.</li>
    </ul>

    <h2 id="notice">2. Sending a notice</h2>
    <p>Send it to the copyright address on the <a href="/legal/contact">contact page</a>, with the subject line <em>Copyright notice</em>. A plain email is sufficient; there is no form to fill in and no account to create.</p>

    <h2 id="contents">3. What a notice must contain</h2>
    <p>A notice that omits these will usually be sent back, because acting on an incomplete claim is neither fair to you nor safe for the site:</p>
    <ol>
      <li>Your full name, postal address, telephone number and email address.</li>
      <li>Identification of the work or works you say are infringed — title, creator, and where it can be verified.</li>
      <li>The exact URL on this site where the allegedly infringing listing or frame appears. "Your whole site" is not a location.</li>
      <li>The URL of the material you say is infringing, if it is not the page on this site.</li>
      <li>A statement that you have a good-faith belief the use is not authorised by the rights holder, its agent, or the law.</li>
      <li>A statement that the information in the notice is accurate, and that you are the rights holder or are authorised to act on their behalf.</li>
      <li>Your signature, physical or electronic.</li>
    </ol>
    <p>Under the Copyright Act 1968 (Cth), a service provider's takedown scheme turns on a notice that complies with the prescribed form. This list is aligned with that scheme and with the United States DMCA so one notice can serve both. It is not a substitute for the prescribed form if one is ever formally required.</p>

    <h2 id="after">4. What happens next</h2>
    <ul>
      <li><strong>On receipt:</strong> the listing or frame identified in a compliant notice is disabled or removed on an interim basis, ordinarily within <code>[N] business days</code>, without waiting for the dispute to be resolved.</li>
      <li><strong>Notification:</strong> where a third party supplied the material and contact details are available, they are told what was removed and why.</li>
      <li><strong>Assessment:</strong> the claim is checked against the notice requirements above. An obviously defective notice is answered with what is missing.</li>
      <li><strong>Outcome:</strong> the removal is made permanent, or the material is restored if the claim does not stand or a valid counter-notice is received and you do not commence proceedings.</li>
    </ul>
    <p>No fee is charged and no legal form is required beyond a clear written statement.</p>

    <h2 id="counter">5. Counter-notice</h2>
    <p>If material of yours was removed and you believe that was a mistake or a misidentification, send a counter-notice to the same address, with the subject <em>Counter-notice</em>. It should identify the removed material, state under what basis you say it was lawful, give your contact details and consent to the jurisdiction of the courts of Western Australia, and include your signature.</p>
    <p>A valid counter-notice is passed to the original complainant. If they do not notify the operator of proceedings to restrain the use within a reasonable period, ordinarily <code>[10 to 14] days</code>, the material may be restored.</p>

    <h2 id="repeat">6. Repeat infringement</h2>
    <p>Where a source or supplier is the subject of repeated valid notices, it is removed from the directory permanently rather than restored. That applies to sources the operator lists, not to third-party sites the operator has no control over.</p>

    <h2 id="false">7. False notices</h2>
    <p>A notice containing a material misrepresentation can expose the sender to liability to the person harmed — under the DMCA in the United States, and under ordinary Australian law for injurious falsehood or misleading conduct. Please be accurate, and say so plainly if you are unsure.</p>

    <h2 id="dmca">8. If you are in the United States</h2>
    <p>The same address and the same list of contents apply. The operator's designated agent details are <code>[DESIGNATED COPYRIGHT AGENT, IF ONE IS APPOINTED]</code>. If no agent has been appointed, that field will stay blank rather than name somebody who has not consented.</p>
    `,
  },

  {
    slug: 'disclaimer',
    label: 'Disclaimer',
    kicker: 'Legal · Disclaimer',
    title: 'Disclaimer | ZenouMath',
    desc: 'The limits of what ZenouMath is: a study aid, not a school, not advice, not a guarantee, and not responsible for third-party sites.',
    h1: 'Disclaimer',
    intro: 'What this site is not, stated as plainly as it can be.',
    toc: [
      ['school', 'Not a school'],
      ['advice', 'Not advice'],
      ['accuracy', 'Accuracy'],
      ['thirdparty', 'Third-party content'],
      ['availability', 'Availability'],
      ['warranty', 'Warranty and consumer law'],
    ],
    body: `
    <h2 id="school">1. Not a school, not accredited, not affiliated</h2>
    <p>ZenouMath is an independent website. It is not a school, college, university or registered training organisation. It is not accredited by any authority. It holds no affiliation with, endorsement from, or authorisation by any school, education department, examination board or curriculum body.</p>
    <p>The academic vocabulary — practice, lecture hall, reference desk, tutor room, shelf — is the site's own naming for its sections. It describes how those sections are used. It does not describe an institution, and it does not mean any content here has been reviewed or approved by a teacher, examiner or curriculum authority.</p>

    <h2 id="advice">2. Not advice</h2>
    <p>Nothing on this site is legal, medical, financial or academic advice. It is not a citation source for assessed work, and it does not replace material set by your own institution. If a question matters, ask a qualified person.</p>

    <h2 id="accuracy">3. Accuracy</h2>
    <p>Film and television metadata is supplied by TMDB and reproduced as received. It can be incomplete, out of date or simply wrong. Any framing verdict in the source directory is a snapshot of what a host answered at a moment in time, not a permanent property of that host. Corrections are welcome and acted on; see the <a href="/legal/contact">contact page</a>.</p>

    <h2 id="thirdparty">4. Third-party content</h2>
    <p>The site links to, frames and embeds material it does not own, control, host or license. It is not responsible for the content, accuracy, legality, safety or availability of any third-party site, player, game build or assistant. Following a link is a decision made by you, and the third party's terms and privacy policy apply from the moment their page loads.</p>

    <h2 id="availability">5. Availability</h2>
    <p>The site is free and provided as-is. It may be unavailable, slow, or missing a feature at any time, and it may change without notice. Third-party embeds fail regularly and for reasons outside the operator's control.</p>

    <h2 id="warranty">6. Warranty and consumer law</h2>
    <p>To the extent permitted by law, no warranty is given that the site will be uninterrupted, error-free, secure or fit for a particular purpose.</p>
    <div class="legal-callout">
      <strong>This disclaimer does not exclude, restrict or modify any guarantee, right or remedy you have under the Australian Consumer Law</strong> that cannot lawfully be excluded. Where the law does allow a term to be limited, the limit is set out in the <a href="/legal/liability">Limitation of Liability</a> page.
    </div>
    <p>A disclaimer limits what the site promises. It does not make the operator immune from liability, and it is not presented here as if it could.</p>
    `,
  },

  {
    slug: 'liability',
    label: 'Limitation of Liability',
    kicker: 'Legal · Liability',
    title: 'Limitation of Liability | ZenouMath',
    desc: 'How far the operator of ZenouMath is responsible for loss, what is excluded, and which rights cannot be excluded under Australian law.',
    h1: 'Limitation of Liability',
    intro: 'A free site still owes you honesty. This page says where responsibility stops, and what the law will not let it stop.',
    toc: [
      ['risk', 'Use at your own risk'],
      ['excluded', 'What is excluded'],
      ['cap', 'The cap'],
      ['acl', 'Rights that cannot be excluded'],
      ['indemnity', 'Indemnity'],
      ['survival', 'Survival'],
    ],
    body: `
    <h2 id="risk">1. Use at your own risk</h2>
    <p>You access ZenouMath at your own discretion. You decide what to open, what to play, what to frame and what to send through the doorway. The operator does not supervise your use and cannot see it.</p>

    <h2 id="excluded">2. What is excluded</h2>
    <p>To the maximum extent permitted by law, the operator is not liable for:</p>
    <ul>
      <li>indirect, incidental, special or consequential loss;</li>
      <li>loss of data, including anything held in your browser's <code>localStorage</code> that is lost when you clear site data;</li>
      <li>loss of marks, time, opportunity or reputation arising from reliance on anything here;</li>
      <li>the acts, omissions, content, availability or security of any third-party site, player, game build, assistant or proxy;</li>
      <li>any loss caused by your own breach of the <a href="/legal/acceptable-use">Acceptable Use Policy</a> or of the law.</li>
    </ul>

    <h2 id="cap">3. The cap</h2>
    <p>Where liability cannot lawfully be excluded but can lawfully be limited, the operator's total aggregate liability arising out of or in connection with the site is limited to <code>[AUD AMOUNT — a nominal sum, commonly AUD 100]</code>.</p>
    <p>That figure is deliberately small because the service is free. A cap set above what the service could ever earn is not a limit; it is a fiction. If a court finds the cap unenforceable in your circumstances, the ordinary law applies instead.</p>

    <h2 id="acl">4. Rights that cannot be excluded</h2>
    <div class="legal-callout">
      <strong>Nothing in this page excludes, restricts or modifies any guarantee, condition, warranty, right or remedy you have under the Australian Consumer Law</strong> — including the consumer guarantees in sections 51 to 59 of the Competition and Consumer Act 2010 (Cth) — where those apply and cannot lawfully be excluded.
    </div>
    <p>If a guarantee applies and the failure is not a major failure, the operator's liability is limited, at its option and to the extent the law allows, to resupplying the service or paying the cost of resupply. Because the service is free, that remedy will usually be the cost of resupply, which is nil.</p>
    <p>Nothing here limits liability for fraud, for deliberately misleading conduct, for death or personal injury caused by negligence where such a limit is prohibited, or for anything else the law does not allow to be limited.</p>

    <h2 id="indemnity">5. Indemnity</h2>
    <p>To the extent permitted by law, you indemnify the operator against claims, losses and reasonable legal costs arising from your breach of these terms or your unlawful use of the site. Where you are a consumer, this clause is not intended to operate unfairly and will not be read as covering loss caused by the operator's own conduct.</p>

    <h2 id="survival">6. Survival</h2>
    <p>This page continues to apply after you stop using the site, and it forms part of the <a href="/legal/terms">Terms of Service</a>.</p>
    `,
  },

  {
    slug: 'contact',
    label: 'Contact',
    kicker: 'Legal · Contact',
    title: 'Contact and legal enquiries | ZenouMath',
    desc: 'Where to send corrections, privacy requests, copyright notices and legal correspondence about ZenouMath, and what to include.',
    h1: 'Contact and legal enquiries',
    intro: 'One operator, no support desk. Use the right subject line and it gets read.',
    toc: [
      ['addresses', 'Where to write'],
      ['include', 'What to include'],
      ['times', 'Response times'],
      ['review', 'What needs review'],
    ],
    body: `
    <h2 id="addresses">1. Where to write</h2>
    <table class="legal-table">
      <thead><tr><th>Matter</th><th>Address</th><th>Subject line</th></tr></thead>
      <tbody>
        <tr><td>General corrections, broken links, a wrong credit</td><td><a href="mailto:${EMAIL}">${EMAIL}</a></td><td><em>Correction</em></td></tr>
        <tr><td>Copyright notice</td><td><a href="mailto:${EMAIL}">${EMAIL}</a></td><td><em>Copyright notice</em></td></tr>
        <tr><td>Counter-notice</td><td><a href="mailto:${EMAIL}">${EMAIL}</a></td><td><em>Counter-notice</em></td></tr>
        <tr><td>Privacy request or complaint</td><td><a href="mailto:${EMAIL}">${EMAIL}</a></td><td><em>Privacy</em></td></tr>
        <tr><td>Abuse or a hijacked listing</td><td><a href="mailto:${EMAIL}">${EMAIL}</a></td><td><em>Abuse</em></td></tr>
        <tr><td>Formal legal correspondence</td><td><code>${ADDRESS}</code></td><td>—</td></tr>
      </tbody>
    </table>
    <p>The operator's legal name is <code>${OPERATOR}</code>, trading as ZenouMath, with ABN <code>${ABN}</code>. These fields are placeholders until the operator supplies the real values; they are not invented here to look complete.</p>

    <h2 id="include">2. What to include</h2>
    <ul>
      <li>The exact URL on this site, not just the section name.</li>
      <li>What you saw and what you expected instead.</li>
      <li>For a copyright matter, the contents listed in the <a href="/legal/takedown#contents">takedown process</a>.</li>
      <li>For a privacy matter, what information you want and how you want it delivered.</li>
    </ul>
    <p>Do not send identity documents, passwords or anything else sensitive. None of it is needed to answer any of the matters above.</p>

    <h2 id="times">3. Response times</h2>
    <p>Corrections are ordinarily handled within a week. Copyright notices are handled on an interim basis within <code>[N] business days</code>. Privacy requests are answered within a reasonable period, ordinarily 30 days. There is no telephone support, no live chat and no ticket number.</p>

    <h2 id="review">4. What needs review</h2>
    <p>Four items in this legal centre genuinely require an informed decision before the documents can be relied on. They are listed in full at the top of the <a href="/legal#review">Legal centre</a>:</p>
    <ol>
      <li>whether the operator is an APP entity under the Privacy Act 1988 (Cth);</li>
      <li>whether any safe-harbour protection under section 115A of the Copyright Act 1968 (Cth) is available or claimed;</li>
      <li>how Australian authorisation law applies to the site's links, frames and embeds;</li>
      <li>whether the liability cap survives the unfair-contract and consumer-guarantee provisions.</li>
    </ol>
    <div class="legal-callout">
      <strong>These are questions for an Australian lawyer, not for a template.</strong> Nothing in this legal centre is a substitute for that advice, and nothing in it claims that the site is fully compliant with any regime.
    </div>
    `,
  },
];
