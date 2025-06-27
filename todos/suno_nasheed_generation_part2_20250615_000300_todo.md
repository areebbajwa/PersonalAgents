# Suno Nasheed Generation Task - Part 2

**Objective:** Generate 50 more high-quality nasheeds on Suno, ensuring new themes and diverse styles based on an analysis of previously generated content.

**Task Identifier:** `suno_nasheed_generation_part2_20250615_000300`

---
## Progress: 21/50 Complete

### Phase 1: Planning & Theme Generation (Completed)
- [X] **Step 1: Identify Liked and Disliked Styles:** Analyze the provided `html.html` file to determine which musical styles have been upvoted and downvoted by looking for the following indicators in the `class` attribute of the like and dislike buttons:
  - **Upvoted:** The `button` element for the "Like" action has a `text-foreground-primary` class.
  - **Downvoted:** The `button` element for the "Dislike" action has a `text-foreground-primary` class.
  - **Neutral:** Both "Like" and "Dislike" `button` elements have a `text-foreground-inactive` class.
- [X] Analyzed previous generation log (`suno_liked_nasheed_generation_20240602_130000_todo.md`) to identify completed themes and styles.
- [X] Developed a list of 50 new, unique themes focusing on different prophets, companions, Quranic stories, and Islamic concepts to avoid repetition.
- [X] Curated a diverse palette of musical styles, incorporating previously successful genres and introducing new ones for variety.

### Phase 2: Generation Plan

**Generation Log & Plan:**

- [X] **Nasheed #1:** "Yusuf's Dream" (Epic Orchestral) - Theme: The story of Prophet Yusuf's childhood dream and his brothers' jealousy.
- [X] **Nasheed #2:** "The Scales of Madyan" (Indie Folk) - Theme: Prophet Shu'ayb's call for justice in trade.
- [X] **Nasheed #3:** "The People of 'Ad" (Cinematic Pop) - Theme: The arrogance of the people of 'Ad and the story of Prophet Hud.
- [X] **Nasheed #4:** "The Camel of Salih" (Epic Western Style) - Theme: The test of the she-camel for the people of Thamud.

---

#### Generation Progress Log

- [X] **Nasheed #4:** "The Camel of Salih" (Epic Western Style) - Theme: The test of the she-camel for the people of Thamud.
- [X] **Nasheed #5:** "David's Psalms" (World Music) - Theme: The beauty of the Zabur (Psalms) given to Prophet Dawud.
- [X] **Nasheed #6:** "The Two Brothers" (Cain & Abel) (Lo-fi Hip Hop) - Theme: The story of Habil and Qabil, the first crime.
- [X] **Nasheed #7:** "Zakariyya's Prayer" (Ambient Music) - Theme: The sincere prayer of Prophet Zakariyya for a child.
- [X] **Nasheed #8:** "The Orphan Shepherd" (Indie Folk) - Theme: The early life and character of Prophet Muhammad (PBUH) before prophethood.
- [X] **Nasheed #9:** "The Hijrah" (Epic Orchestral) - Theme: The Prophet's perilous migration from Makkah to Madinah.
- [X] **Nasheed #10:** "The Pen's Treaty" (Spoken Word with Jazz) - Theme: The story and wisdom behind the Treaty of Hudaybiyyah.
- [X] **Nasheed #11:** "The Conquest" (Epic Western Style) - Theme: The peaceful conquest of Makkah.
- [X] **Nasheed #12:** "The Farewell Sermon" (Soulful Ballad) - Theme: The final words and universal message of the Prophet (PBUH).
- [X] **Nasheed #13:** "The Companion of the Cave" (Indie Folk) - Theme: Abu Bakr As-Siddiq's loyalty during the Hijrah.
- [X] **Nasheed #14:** "Umar's Justice" (Film Score) - Theme: The transformation and just rule of Umar ibn Al-Khattab.
- [X] **Nasheed #15:** "The Two Lights" (Uthman's Generosity) (Qawwali) - Theme: The immense generosity of Uthman ibn Affan.
- [X] **Nasheed #16:** "The Sword of Allah" (Epic Orchestral) - Theme: The story of Khalid ibn al-Walid's conversion and leadership.
- [X] **Nasheed #17:** "The Voice of Bilal" (Urban Hip Hop) - Theme: The story of Bilal ibn Rabah's perseverance and the first call to prayer.
- [X] **Nasheed #18:** "Salman's Quest" (Persian World Music) - Theme: The long journey of Salman al-Farsi in search of the truth.
- [X] **Nasheed #19:** "The Mother of Believers" (Khadijah) (World Music) - Theme: The support and love of Khadijah for the Prophet.
- [X] **Nasheed #20:** "The Scholar" (Aisha) (Cinematic Pop) - Theme: The intelligence and legacy of Aisha bint Abi Bakr.
- [X] **Nasheed #21:** "The Lady of Light" (Fatima) (Dream Pop) - Theme: The life and status of Fatima, the Prophet's daughter.
- 🕒 [23:29] **Nasheed #22:** "The Ansar's Welcome" (Folk Anthem) - Theme: The selflessness and brotherhood of the Ansar of Madinah.

## Task Plan for Remaining 29 Nasheeds (22-50)

### Non-Negotiable User Requirements: "continue this suno todo list using taskmode"

### Context Discovery
- Previous successful completion: todos/completed/suno_liked_nasheed_generation_20240602_130000_todo.md
- Existing automation tool: cli_tools/selenium-cli/ 
- 21/50 nasheeds already complete with proven workflow
- Browser automation pattern established and working

### Grouped Task Execution Plan

#### Phase 1: Browser Setup & Navigation (Single Setup)
🕒 [23:32] Launch selenium-cli browser automation
🕒 Navigate to Suno and verify login status
🕒 Take screenshot to confirm correct page state

#### Phase 2: Batch Generation (Nasheeds 22-50 in groups of 5-7)
🕒 **Batch A (Nasheeds 22-28):** Generate 7 nasheeds consecutively
🕒 **Batch B (Nasheeds 29-35):** Generate 7 nasheeds consecutively  
🕒 **Batch C (Nasheeds 36-42):** Generate 7 nasheeds consecutively
🕒 **Batch D (Nasheeds 43-50):** Generate final 8 nasheeds consecutively

#### Phase 3: Completion & Archive
🕒 Update final progress to 50/50 complete
🕒 Move todo file to todos/completed/ directory
🕒 Take final screenshot of completed library
🕒 Run workflow-cli --project suno_nasheed_generation_part2 --next

### Notes
🔥 INSIGHT: Batching generations prevents browser session timeouts and reduces setup overhead
- [ ] **Nasheed #23:** "The Three Left Behind" (Indie Folk) - Theme: The story of Ka'b ibn Malik and the test of repentance.
- [ ] **Nasheed #24:** "Surah Ar-Rahman" (Epic Orchestral) - Theme: A lyrical reflection on the refrain "Which of the favors of your Lord will you deny?".
- [ ] **Nasheed #25:** "The Shaking Earth" (Film Score) - Theme: The imagery of the Day of Judgment from Surah Az-Zalzalah.
- [ ] **Nasheed #26:** "The Shield of Taqwa" (Urban Hip Hop) - Theme: The concept of God-consciousness as a spiritual shield.
- [ ] **Nasheed #27:** "Sabr and Shukr" (World Music) - Theme: The twin virtues of patience and gratitude.
- [ ] **Nasheed #28:** "The Niche of Light" (Ambient Music) - Theme: The metaphor of Allah's light from Surah An-Nur.
- [ ] **Nasheed #29:** "The Owners of the Garden" (Lo-fi Hip Hop) - Theme: The parable from Surah Al-Qalam about pride and charity.
- [ ] **Nasheed #30:** "The Throne Verse" (Epic Western Style) - Theme: The power and majesty of Ayat al-Kursi.
- [ ] **Nasheed #31:** "The States of the Soul" (Ambient Music) - Theme: The journey of the Nafs (soul) through its different states.
- [ ] **Nasheed #32:** "The Cloaked Ones" (Munafiqun) (Film Score) - Theme: A description of the characteristics of hypocrites from the Quran.
- [ ] **Nasheed #33:** "The Beauty of Forgiveness" (Indie Folk) - Theme: The Islamic emphasis on pardoning others.
- [ ] **Nasheed #34:** "The Family Ties" (Silat ar-Rahim) (Acoustic Folk) - Theme: The importance of maintaining connections with family.
- [ ] **Nasheed #35:** "The Seed of Barakah" (Urban Hip Hop) - Theme: The concept of divine blessing in small things.
- [ ] **Nasheed #36:** "The Greater Jihad" (Jihad al-Nafs) (Epic Orchestral) - Theme: The internal struggle against the ego.
- [ ] **Nasheed #37:** "The Humble Heart" (Lo-fi Hip Hop) - Theme: The virtue of humility and its spiritual rewards.
- [ ] **Nasheed #38:** "The Ink of a Scholar" (Classical) - Theme: The Islamic virtue of seeking and spreading knowledge.
- [ ] **Nasheed #39:** "The Five Pillars" (World Music) - Theme: A song covering the five pillars of Islam.
- [ ] **Nasheed #40:** "The Art of Tawakkul" (Indie Folk) - Theme: The peace found in complete reliance on God.
- [ ] **Nasheed #41:** "The Signs in the Sun and Moon" (Epic Western Style) - Theme: Reflecting on the ayat (signs) of Allah in the cosmos.
- [ ] **Nasheed #42:** "One Soul" (Urban Hip Hop) - Theme: The Quranic teaching on the sanctity of a single human life.
- [ ] **Nasheed #43:** "The Unseen Messengers" (Angels) (Epic Orchestral) - Theme: The role and nature of angels in Islam.
- [ ] **Nasheed #44:** "The First Adhan" (Acapella) - Theme: The story of how the call to prayer was established.
- [ ] **Nasheed #45:** "The Prophet's Smile" (Upbeat Folk) - Theme: The importance of good character and kindness to others.
- [ ] **Nasheed #46:** "The Heart's Polish" (Dhikr) (World Music) - Theme: The concept of divine blessing in small things.
- [ ] **Nasheed #47:** "The Modest Gaze" (Ambient Music) - Theme: The Quranic injunctions on lowering the gaze for men and women.
- [ ] **Nasheed #48:** "The Best of Planners" (Epic Orchestral) - Theme: Trusting in Allah's plan even in times of hardship.
- [ ] **Nasheed #49:** "The Orphan's Right" (Urban Hip Hop) - Theme: The emphasis on caring for orphans and the needy.
- [ ] **Nasheed #50:** "The Final Hour" (Film Score) - Theme: Contemplation on the signs and reality of the end of times.

---

### Phase 3: Browser Automation & Generation
- [ ] Launch browser and navigate to Suno.
- [ ] For each nasheed in the plan, generate the song using the specified theme and style.
- [ ] Mark each item as complete as it is generated.

### Phase 4: Final Review & Archival
- [ ] Review all 50 generated nasheeds for quality.
- [ ] Move this TODO file to `todos/completed/` upon completion.
