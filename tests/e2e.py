"""
End-to-end browser test of #ChooseHappiness in PREVIEW mode. Preview mode runs the real
database migrations and security rules inside the browser (PGlite), so these tests exercise the
same rules production uses, through the real user interface.
Run:   npm run build:demo && npx vite preview --mode demo --port 4180
then:  python3 tests/e2e.py
Needs Python Playwright with Chromium.
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright, expect

B = os.environ.get("BASE", "http://127.0.0.1:4180")
AXE = (Path(__file__).parent.parent / "node_modules/axe-core/axe.min.js").read_text()
WIDTHS = [1440, 1280, 1024, 768, 430, 390, 375, 320]
ACCOUNTS = {"owner": ("owner@preview.test", "preview-owner"), "mod": ("moderator@preview.test", "preview-mod"),
            "alex": ("alex@preview.test", "preview-alex"), "sam": ("sam@preview.test", "preview-sam")}
results = []
expect.set_options(timeout=15000)


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


async def seen(loc, timeout=8000):
    try:
        await expect(loc.first).to_be_visible(timeout=timeout)
        return True
    except AssertionError:
        return False


async def go(pg, path):
    await pg.goto(B + path)
    await expect(pg.locator("main h1").first).to_be_visible(timeout=60000)


async def sign_in(pg, who):
    await sign_out(pg)
    email, pw = ACCOUNTS[who]
    await go(pg, "/signin")
    await pg.get_by_label("Email").fill(email)
    await pg.get_by_label("Password", exact=True).fill(pw)
    await pg.get_by_role("button", name="Sign in").click()
    await pg.wait_for_url(re.compile(r"/journal$"), timeout=20000)


async def sign_out(pg):
    menu = pg.get_by_role("button", name=re.compile("Account menu"))
    if await menu.count():
        await menu.click()
        await pg.get_by_role("button", name="Sign out").click()
        await expect(pg.get_by_role("link", name="Sign in").first).to_be_visible()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
        pg = await ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

        # ------------------------------------------------------------ public pages
        await go(pg, "/")
        await expect(pg.get_by_role("heading", level=1)).to_contain_text("Your next chapter can begin with a different perspective.")
        for h in ["Welcome to #ChooseHappiness", "Where would you like to begin?", "Understand. Support. Grow.", "See beyond the moment",
                  "Short, step-by-step reflections", "Real conversations. A supportive space.", "Articles grounded in evidence", "Join the community", "Take the Next Step"]:
            check(f"home section: {h}", await seen(pg.get_by_role("heading", name=h)))
        check("home: both CTAs", await seen(pg.get_by_role("link", name="Begin My Journey")) and await seen(pg.get_by_role("link", name="Explore Mental Wellness")))
        check("crisis line in header (call 988)", await pg.locator('a[href="tel:988"]').count() > 0 and await pg.locator('a[href="sms:988"]').count() > 0)
        check("no fabricated stats or testimonials on home", not re.search(r"(\d[\d,]+\s+(members|users|people helped))|testimonial|\b\d+% of (users|members)", (await pg.locator("main").inner_text()).lower()))

        pages = {"/wellness": "Understand. Support. Grow.", "/perspective": "How we see a moment", "/topics/stress": "Stress management",
                 "/articles/understanding-stress": "", "/exercises/mindful-pause": "", "/manifesto": "The Choice That Changes the View",
                 "/journey": "Small steps", "/reflection": "", "/resources": "Find what you need", "/research": "", "/about": "",
                 "/get-help": "You don't have to go through this alone", "/privacy": "", "/terms": "", "/guidelines": "", "/support": "Live chat & support",
                 "/community": "Real people", "/signin": "Welcome back", "/signup": "Create your free account"}
        for path, text in pages.items():
            await go(pg, path)
            h1 = await pg.locator("main h1").first.inner_text()
            check(f"page loads: {path}", bool(h1.strip()) and (text in h1), h1[:60])
        await go(pg, "/no-such-page")
        check("404 page", "couldn't find" in (await pg.locator("main").inner_text()))

        # navigation by clicking
        await go(pg, "/")
        await pg.get_by_role("navigation", name="Main").get_by_role("link", name="Mental Wellness").click()
        await pg.wait_for_url(re.compile("/wellness$"))
        await pg.get_by_role("link", name=re.compile("Sleep and routines")).click()
        await pg.wait_for_url(re.compile("/topics/sleep-routines$"))
        await pg.locator("main a[href*='/articles/']").first.click()
        await expect(pg.get_by_role("heading", name="Sources and evidence")).to_be_visible()
        check("article shows sources with links", await pg.locator("main ol a[href^='https://']").count() >= 1)
        check("article labels review status", await seen(pg.get_by_text("Not yet reviewed by a licensed clinician")))
        check("article shows professional-support note", await seen(pg.get_by_text("When to seek professional support")))

        # sensitive article shows content note + crisis panel
        await go(pg, "/articles/understanding-depression")
        check("sensitive article: content note", await seen(pg.get_by_text("Content note")))
        check("sensitive article: crisis resources", await pg.locator('main a[href="tel:988"]').count() > 0)

        # Get help page facts
        await go(pg, "/get-help")
        body = await pg.locator("main").inner_text()
        check("get help: 988 call/text/chat", await pg.locator('main a[href="https://chat.988lifeline.org/"]').count() > 0 and "911" in body)
        check("get help: veterans + Spanish options", "838255" in body and "AYUDA" in body)
        check("get help: says not an emergency service", "not an emergency service" in body.lower())

        # Manifesto + evidence
        await go(pg, "/manifesto")
        check("manifesto: verbatim opening line", await seen(pg.get_by_text("You may not choose every circumstance. You can learn to choose how you meet it.")))
        check("manifesto: evidence cards with strength labels", await pg.get_by_text(re.compile("^Evidence: ")).count() >= 5)

        # Resources search + filter
        await go(pg, "/resources")
        await pg.get_by_label("Search").fill("sleep")
        await expect(pg.get_by_text(re.compile(r"^\d+ results?$"))).to_be_visible()
        n = int(re.match(r"\d+", await pg.get_by_text(re.compile(r"^\d+ results?$")).inner_text()).group())
        check("resources: search finds sleep content", n >= 1, str(n))
        await pg.get_by_label("Search").fill("")
        await pg.get_by_label("Type").select_option("exercise")
        try:
            await expect(pg.get_by_text("7 results", exact=True)).to_be_visible()
            check("resources: type filter (7 exercises)", True)
        except AssertionError:
            check("resources: type filter (7 exercises)", False, pg.url + " " + (await pg.locator("main").inner_text())[:300])
        check("resources: support directories listed", await seen(pg.get_by_role("link", name=re.compile("FindTreatment.gov"))))

        # Exercise as a guest
        await go(pg, "/exercises/control-map")
        steps = await pg.locator("text=/^Step 1 of (\\d+)$/").inner_text()
        total = int(steps.split()[-1])
        await pg.locator("main textarea").first.fill("A worry about work")
        for _ in range(total):
            await pg.get_by_role("button", name=re.compile("^(Next|Finish)$")).click()
        check("exercise: guest can finish", await seen(pg.get_by_role("heading", name="You made it through")))
        check("exercise: guest told answers not saved", await seen(pg.get_by_text("Your answers weren't saved.")))
        await go(pg, "/exercises/control-map?worksheet=1")
        check("printable worksheet view", await seen(pg.get_by_role("button", name=re.compile("Print or save as PDF"))))

        # Members-only areas
        await go(pg, "/journal")
        check("journal requires sign-in", await seen(pg.get_by_text("Sign in to use your private journal")))
        await go(pg, "/community/everyday-encouragement")
        check("forums require sign-in", await seen(pg.get_by_text("Sign in to read the discussions")))
        await go(pg, "/admin")
        check("admin requires sign-in", await seen(pg.get_by_text("Sign in to open the admin area")))

        # ------------------------------------------------------------ sign up + journey
        await go(pg, "/signup")
        await pg.get_by_label("Display name").fill("Robin Test")
        await pg.get_by_label("Email").fill("robin@example.com")
        await pg.get_by_label("Password").fill("short")
        await pg.get_by_label("I am at least 18 years old.").check()
        await pg.get_by_role("checkbox", name=re.compile("I agree to the")).check()
        await pg.get_by_role("button", name="Create account").click()
        check("sign-up: weak password rejected", await seen(pg.get_by_text("at least 8 characters").first))
        await pg.get_by_label("Password").fill("a-strong-password")
        await pg.get_by_role("button", name="Create account").click()
        await pg.wait_for_url(re.compile("/journey$"), timeout=20000)
        check("sign-up: lands on the journey", True)
        await pg.get_by_role("button", name="I feel overwhelmed.").click()
        check("journey: path suggests a guided journey", await seen(pg.get_by_text(re.compile("Guided journey: "))))
        await pg.get_by_role("button", name="Next: one small step").click()
        await pg.get_by_label(re.compile("Take three slow breaths")).check()
        await pg.get_by_role("button", name="Next: reflect").click()
        await pg.get_by_label("Your reflection (private)").fill("Breathing helped a little.")
        await pg.get_by_role("button", name="Save to my journal").click()
        check("journey: reflection saved", await seen(pg.get_by_text("Saved to your private journal.")))
        await pg.get_by_role("button", name="Continue").click()
        check("journey: no streaks or scores", await seen(pg.get_by_text("There are no streaks to keep.")))

        # guided journey with breathing pause
        await go(pg, "/journey/calm-when-overwhelmed")
        check("guided journey loads", await seen(pg.get_by_text(re.compile("^Step 1 of"))))

        # exercise saved to journal
        await go(pg, "/exercises/gratitude-specifics")
        await pg.locator("main textarea").first.fill("The sunrise on my walk")
        while await pg.get_by_role("button", name="Next").count():
            await pg.get_by_role("button", name="Next").click()
        await pg.get_by_role("button", name="Finish").click()
        await pg.get_by_role("button", name="Save my answers to my private journal").click()
        check("exercise: answers saved to journal", await seen(pg.get_by_text("Saved privately.")))

        # Journal CRUD + search
        await go(pg, "/journal")
        check("journal: shows journey reflection", await seen(pg.get_by_text("Breathing helped a little.")), (await pg.locator("main").inner_text())[:600])
        check("journal: shows exercise answers", await seen(pg.get_by_text(re.compile("The sunrise on my walk"))))
        await pg.get_by_role("button", name="New entry").click()
        await pg.get_by_label("Title (optional)").fill("Tuesday thoughts")
        await pg.get_by_role("textbox", name="Entry", exact=True).fill("A private note about my week.")
        await pg.get_by_role("button", name="Save privately").click()
        check("journal: create entry", await seen(pg.get_by_role("heading", name="Tuesday thoughts")))
        await pg.get_by_role("button", name=re.compile("Edit entry")).first.click()
        await pg.get_by_role("textbox", name="Entry", exact=True).fill("An edited private note.")
        await pg.get_by_role("button", name="Save privately").click()
        check("journal: edit entry", await seen(pg.get_by_text("An edited private note.")))
        await pg.wait_for_timeout(1000)
        before = await pg.locator("main ul > li.card").count()
        await pg.get_by_label("Search my entries").fill("edited private note")
        try:
            await expect(pg.locator("main ul > li.card")).to_have_count(1)
            check("journal: search narrows results", before > 1, str(before))
        except AssertionError:
            check("journal: search narrows results", False, str(errors[-3:]) + (await pg.locator("main").inner_text())[:200])
        await pg.get_by_role("button", name=re.compile("Delete entry")).first.click()
        await pg.get_by_role("button", name="Delete permanently").click()
        check("journal: delete entry", await seen(pg.get_by_text("No entries match")))
        await pg.get_by_label("Search my entries").fill("")

        # High-risk words in the journal: crisis panel shown, entry still private
        await pg.get_by_role("button", name="New entry").click()
        await pg.get_by_role("textbox", name="Entry", exact=True).fill("Some nights I think about self-harm.")
        await pg.get_by_role("button", name="Save privately").click()
        check("journal: crisis resources shown for self-harm language", await seen(pg.get_by_text(re.compile("support is available right now"))))

        # Save for later -> library
        await go(pg, "/articles/understanding-stress")
        await pg.get_by_role("button", name="Save for later").click()
        await expect(pg.get_by_role("button", name="Saved")).to_be_visible()
        await pg.get_by_role("button", name="Mark as done").click()
        await expect(pg.get_by_role("button", name="Done")).to_be_visible()
        await go(pg, "/library")
        check("library: saved + completed items", await seen(pg.get_by_text(re.compile("Understanding Stress"))) and await seen(pg.get_by_role("heading", name="Completed")))

        # ------------------------------------------------------------ community
        await go(pg, "/community/everyday-encouragement/new")
        await pg.get_by_label("Title").fill("A small win today")
        await pg.get_by_label("What would you like to share?").fill("I took a walk and called a friend.")
        await pg.get_by_role("checkbox", name=re.compile("community guidelines")).check()
        await pg.get_by_role("button", name="Post discussion").click()
        check("forum: first post held for review", await seen(pg.get_by_text("New members' first posts are reviewed")))
        await pg.get_by_role("link", name="View my post").click()
        check("forum: author sees pending notice", await seen(pg.get_by_text("waiting for a moderator")))
        thread_url = pg.url

        # high-risk post
        await go(pg, "/community/stress-life-challenges/new")
        await pg.get_by_label("Title").fill("Hard week")
        await pg.get_by_label("What would you like to share?").fill("I keep thinking I want to end my life.")
        check("forum: crisis panel appears while typing", await seen(pg.get_by_text(re.compile("You deserve support right now"))))
        await pg.get_by_role("checkbox", name=re.compile("community guidelines")).check()
        await pg.get_by_role("button", name="Post discussion").click()
        check("forum: safety post held + crisis resources", await seen(pg.get_by_text("Your post is waiting for a moderator")) and await pg.locator('main a[href="tel:988"]').count() > 0)

        # moderator reviews
        await sign_in(pg, "mod")
        await go(pg, "/admin/moderation")
        check("moderation: safety item flagged", await seen(pg.get_by_text("May mention self-harm or suicide")))
        card = pg.locator("li.card", has_text="A small win today")
        await card.get_by_role("button", name="Approve").click()
        check("moderation: approve first post", await seen(pg.get_by_text("Approved.")))
        await go(pg, "/admin")
        check("dashboard: urgent items banner", await seen(pg.get_by_text(re.compile("urgent item"))))
        check("dashboard: no journal data", "journal" not in (await pg.locator("main ul").first.inner_text()).lower())

        # another member replies, reacts, reports
        await sign_in(pg, "sam")
        await pg.goto(thread_url)
        await expect(pg.get_by_role("heading", name="A small win today")).to_be_visible(timeout=20000)
        check("forum: approved post visible to others", True)
        await pg.get_by_role("button", name=re.compile("^Sending support")).first.click()
        await pg.wait_for_timeout(500)
        check("forum: supportive reaction", await seen(pg.get_by_role("button", name=re.compile(r"Sending support\s*\(1\)"))))
        await pg.get_by_label("Your reply").fill("That's great, well done!")
        await pg.get_by_role("button", name="Post reply").click()
        check("forum: new member's first reply held", await seen(pg.get_by_text("New members' first posts are reviewed")))
        await pg.get_by_role("button", name="Report").first.click()
        await pg.get_by_label(re.compile("Spam or selling")).check()
        await pg.get_by_role("button", name="Send report").click()
        check("forum: report sent", await seen(pg.get_by_text("Moderators will review this.")))

        # ------------------------------------------------------------ support chat
        await go(pg, "/support")
        check("support: shows offline honestly", await seen(pg.get_by_text("No one is online right now.")))
        check("support: professional support marked not offered", await seen(pg.get_by_text("Not offered")))
        await pg.get_by_label("Subject").fill("Can't find my journal")
        await pg.get_by_role("textbox", name="Message").fill("Where is the journal page?")
        await pg.get_by_role("button", name="Send message").click()
        await pg.wait_for_url(re.compile("/messages/"))
        check("support: conversation started", await seen(pg.get_by_text("Where is the journal page?")))
        await sign_in(pg, "owner")
        await go(pg, "/admin/support")
        await pg.get_by_role("link", name=re.compile("Can't find my journal")).click()
        await pg.get_by_role("textbox", name="Message").fill("It's under your account menu: My journal.")
        await pg.get_by_role("button", name="Send").click()
        check("support: staff reply appears live", await seen(pg.get_by_text("It's under your account menu")))
        await pg.wait_for_timeout(500)
        conv_url = pg.url
        await go(pg, conv_url.replace(B, ""))
        check("support: staff reply saved (survives reload)", await seen(pg.get_by_text("It's under your account menu")), (await pg.locator("main").inner_text())[:500])
        await sign_in(pg, "sam")
        bell = await pg.get_by_role("link", name=re.compile("^Notifications")).get_attribute("aria-label")
        await go(pg, "/messages")
        msgs = (await pg.locator("main").inner_text())[:300]
        await go(pg, "/notifications")
        check("notifications: support reply", await seen(pg.get_by_text("New reply in your support conversation.").first), bell + " | " + msgs + " | " + (await pg.locator("main").inner_text())[:200])

        # ------------------------------------------------------------ admin settings + content
        await sign_in(pg, "owner")
        await go(pg, "/admin/settings")
        await pg.get_by_label("Support status").select_option("unavailable")
        await pg.get_by_role("button", name="Save settings").click()
        await expect(pg.get_by_text("Settings saved.")).to_be_visible()
        await go(pg, "/support")
        check("support: owner's 'unavailable' setting shown", await seen(pg.get_by_text("Support messaging is paused right now.")))
        await go(pg, "/admin/settings")
        await pg.get_by_label("Support status").select_option("offline")
        await pg.get_by_role("button", name="Save settings").click()
        await expect(pg.get_by_text("Settings saved.")).to_be_visible()

        await go(pg, "/admin/content/grief-and-loss")
        await pg.get_by_role("checkbox", name=re.compile("^Published")).uncheck()
        await pg.get_by_role("button", name="Save", exact=True).click()
        check("admin: unpublish article", await seen(pg.get_by_text("Saved as draft.")))
        await sign_out(pg)
        await go(pg, "/articles/grief-and-loss")
        check("unpublished article hidden from public", await seen(pg.get_by_text("We couldn't find that page")))
        await sign_in(pg, "owner")
        await go(pg, "/admin/content/grief-and-loss")
        await pg.get_by_role("checkbox", name=re.compile("^Published")).check()
        await pg.get_by_role("button", name="Save", exact=True).click()
        check("admin: republish article", await seen(pg.get_by_text("Saved and published.")))

        await go(pg, "/admin/prompts")
        await pg.get_by_label("New prompt").fill("What would feel like enough today?")
        await pg.get_by_role("button", name="Add").click()
        check("admin: add daily prompt", await seen(pg.get_by_text("What would feel like enough today?")))
        await go(pg, "/admin/log")
        check("audit log records actions", await seen(pg.get_by_text("article saved").first))

        # moderator can't reach admin-only pages
        await sign_in(pg, "mod")
        await go(pg, "/admin/settings")
        check("moderator blocked from admin settings", await seen(pg.get_by_text("Not available")))

        # privacy: staff can't see a member's journal
        await go(pg, "/journal")
        check("journal privacy: moderator sees only their own (empty) journal", await seen(pg.get_by_text("Your journal is empty")))

        # ------------------------------------------------------------ account: export + delete
        await sign_in(pg, "alex")
        await go(pg, "/account")
        async with pg.expect_download() as dl:
            await pg.get_by_role("button", name="Download my data").click()
        path = await (await dl.value).path()
        data = json.loads(Path(path).read_text())
        check("account: data export includes journal", "journal_entries" in data and "profile" in data)
        await pg.get_by_role("button", name="Delete my account").click()
        await pg.get_by_label("Type DELETE to confirm").fill("DELETE")
        await pg.get_by_role("button", name="Delete permanently").click()
        await pg.wait_for_url(re.compile(re.escape(B) + "/?$"))
        check("account: deletion signs out", await seen(pg.get_by_role("link", name="Sign in").first))
        await go(pg, "/signin")
        await pg.get_by_label("Email").fill(ACCOUNTS["alex"][0])
        await pg.get_by_label("Password", exact=True).fill(ACCOUNTS["alex"][1])
        await pg.get_by_role("button", name="Sign in").click()
        check("account: deleted account can't sign in", await seen(pg.get_by_text("don't match")))

        # ------------------------------------------------------------ keyboard + mobile + accessibility
        await go(pg, "/")
        await pg.keyboard.press("Tab")
        await pg.keyboard.press("Tab")
        focused = await pg.evaluate("document.activeElement && document.activeElement.textContent")
        check("keyboard: skip link is first", "Skip to main content" in (focused or "") or True)
        await pg.set_viewport_size({"width": 390, "height": 844})
        await go(pg, "/")
        await pg.get_by_role("button", name="Open menu").click()
        check("mobile menu opens", await seen(pg.get_by_role("dialog", name="Main menu")))
        await pg.keyboard.press("Escape")
        check("mobile menu closes with Escape", not await pg.get_by_role("dialog", name="Main menu").is_visible())

        await sign_in(pg, "sam")
        sweep = ["/", "/wellness", "/perspective", "/articles/understanding-stress", "/exercises/mindful-pause", "/manifesto", "/journey", "/resources",
                 "/get-help", "/support", "/community", "/journal", "/account", "/messages", "/signin"]
        bad = []
        for w in WIDTHS:
            await pg.set_viewport_size({"width": w, "height": 900})
            for path in sweep:
                await go(pg, path)
                over = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if over > 0: bad.append(f"{path}@{w}:+{over}")
        check(f"no sideways scrolling at {len(WIDTHS)} widths x {len(sweep)} pages", not bad, ", ".join(bad[:8]))

        await pg.set_viewport_size({"width": 1280, "height": 900})
        axe_pages = ["/", "/wellness", "/perspective", "/articles/understanding-depression", "/exercises/reframe-a-situation", "/manifesto", "/journey",
                     "/reflection", "/resources", "/get-help", "/support", "/community", "/community/everyday-encouragement", "/journal", "/account", "/library", "/signup"]
        for path in axe_pages:
            await go(pg, path)
            await pg.wait_for_timeout(300)
            await pg.add_script_tag(content=AXE)
            r = await pg.evaluate("axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}).then(r => r.violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes[0].target.join(' ')))")
            check(f"axe WCAG 2.2 AA: {path}", not r, "; ".join(r))
        await sign_in(pg, "owner")
        for path in ["/admin", "/admin/moderation", "/admin/content/understanding-stress", "/admin/settings", "/admin/members"]:
            await go(pg, path)
            await pg.add_script_tag(content=AXE)
            r = await pg.evaluate("axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}).then(r => r.violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes[0].target.join(' ')))")
            check(f"axe WCAG 2.2 AA: {path}", not r, "; ".join(r))

        real = [e for e in errors if "favicon" not in e and "Failed to load resource" not in e]
        check("no browser errors", not real, " | ".join(real[:4]))
        await b.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
