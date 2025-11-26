// update-preview-real-content.js - Cập nhật preview content thật từ nguồn internet
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Book = require('./models/Book');
const PreviewContent = require('./models/PreviewContent');

const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';

// Mapping sách với thông tin để tìm preview
const bookPreviewSources = {
    "The Great Gatsby": {
        preview: `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.

"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven't had the advantages that you've had."

He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.`
    },
    "The Catcher in the Rye": {
        preview: `If you really want to hear about it, the first thing you'll probably want to know is where I was born, and what my lousy childhood was like, and how my parents were occupied and all before they had me, and all that David Copperfield kind of crap, but I don't feel like going into it, if you want to know the truth. In the first place, that stuff bores me, and in the second place, my parents would have about two hemorrhages apiece if I told anything pretty personal about them. They're quite touchy about anything like that, especially my father. They're nice and all—I'm not saying that—but they're also touchy as hell. Besides, I'm not going to tell you my whole goddam autobiography or anything. I'll just tell you about this madman stuff that happened to me around last Christmas just before I got pretty run-down and had to come out here and take it easy. I mean that's all I told D.B. about, and he's my brother and all. He's in Hollywood. That isn't too far from this crumby place, and he comes over and visits me practically every week end. He's going to drive me home when I go home next month maybe. He just got a Jaguar. One of those little English jobs that can do around two hundred miles an hour. It cost him damn near four thousand bucks. He's got a lot of dough, now. He didn't use to. He used to be just a regular writer, when he was home. He wrote this terrific book of short stories, The Secret Goldfish. It's about this little kid that wouldn't let anybody look at his goldfish because he'd bought it with his own money. It killed me. Now he's out in Hollywood, D.B., being a prostitute. If there's one thing I hate, it's the movies. Don't even mention them to me.`
    },
    "1984": {
        preview: `It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.

The hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for indoor display, had been tacked to the wall. It depicted simply an enormous face, more than a metre wide: the face of a man of about forty-five, with a heavy black moustache and ruggedly handsome features.`
    },
    "To Kill a Mockingbird": {
        preview: `When he was nearly thirteen, my brother Jem got his arm badly broken at the elbow. When it healed, and Jem's fears of never being able to play football were assuaged, he was seldom self-conscious about his injury. His left arm was somewhat shorter than his right; when he stood or walked, the back of his hand was at right angles to his body, his thumb parallel to his thigh. He couldn't have cared less, so long as he could pass and punt.

When enough years had gone by to enable us to look back on them, we sometimes discussed the events leading to his accident. I maintain that the Ewells started it all, but Jem, who was four years my senior, said it started long before that.`
    },
    "Pride and Prejudice": {
        preview: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"

Mr. Bennet replied that he had not.

"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."`
    },
    "Dune": {
        preview: `A beginning is the time for taking the most delicate care that the balances are correct. This every sister of the Bene Gesserit knows. To begin your study of the life of Muad'Dib, then, take care that you first place him in his time: born in the 57th year of the Padishah Emperor, Shaddam IV. And take the most special care that you locate Muad'Dib in his place: the planet Arrakis. Do not be deceived by the fact that he was born on Caladan and lived his first fifteen years there. Arrakis, the planet known as Dune, is forever his place.`
    },
    "The Lord of the Rings": {
        preview: `When Mr. Bilbo Baggins of Bag End announced that he would shortly be celebrating his eleventy-first birthday with a party of special magnificence, there was much talk and excitement in Hobbiton. Bilbo was very rich and very peculiar, and had been the wonder of the Shire for sixty years, ever since his remarkable disappearance and unexpected return. The riches he had brought back from his travels had now become a local legend, and it was popularly believed, whatever the old folk might say, that the Hill at Bag End was full of tunnels stuffed with treasure. The fact that his nephew and adopted heir Frodo had come of age when he himself was ninety-nine was also a matter for much congratulation. The young hobbits, especially Sam Gamgee who was gardener at Bag End, were all excited about the party. The invitations had been sent out, and preparations were being made for a celebration that would be remembered for many years. But Bilbo had something else on his mind. He had been troubled by thoughts of the Ring he had found many years ago, and he felt that the time had come to pass it on.`
    },
    "The Hobbit": {
        preview: `In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort. It had a perfectly round door like a porthole, painted green, with a shiny yellow brass knob in the exact middle. The door opened on to a tube-shaped hall like a tunnel: a very comfortable tunnel without smoke, with panelled walls, and floors tiled and carpeted, provided with polished chairs, and lots and lots of pegs for hats and coats—the hobbit was fond of visitors. The tunnel wound on and on, going fairly but not quite straight into the side of the hill—The Hill, as all the people for many miles round called it—and many little round doors opened out of it, first on one side and then on another. No going upstairs for the hobbit: bedrooms, bathrooms, cellars, pantries (lots of these), wardrobes (he had whole rooms devoted to clothes), kitchens, dining-rooms, all were on the same floor, and indeed on the same passage. The best rooms were all on the left-hand side (going in), for these were the only ones to have windows, deep-set round windows looking over his garden, and meadows beyond, sloping down to the river.`
    },
    "Sapiens: A Brief History of Humankind": {
        preview: `About 13.5 billion years ago, matter, energy, time and space came into being in what is known as the Big Bang. The story of these fundamental features of our universe is called physics.

About 300,000 years after their appearance, matter and energy started to coalesce into complex structures, called atoms, which then combined into molecules. The story of atoms, molecules and their interactions is called chemistry.

About 3.8 billion years ago, on a planet called Earth, certain molecules combined to form particularly large and intricate structures called organisms. The story of organisms is called biology.`
    },
    "Cosmos": {
        preview: `The cosmos is all that is or ever was or ever will be. Our feeblest contemplations of the cosmos stir us—there is a tingling in the spine, a catch in the voice, a faint sensation, as if a distant memory, of falling from a height. We know we are approaching the greatest of mysteries.

The size and age of the cosmos are beyond ordinary human understanding. Lost somewhere between immensity and eternity is our tiny planetary home. In a cosmic perspective, most human concerns seem insignificant, even petty. And yet our species is young and curious and brave and shows much promise.`
    },
    "A Brief History of Time": {
        preview: `A well-known scientist (some say it was Bertrand Russell) once gave a public lecture on astronomy. He described how the earth orbits around the sun and how the sun, in turn, orbits around the center of a vast collection of stars called our galaxy. At the end of the lecture, a little old lady at the back of the room got up and said: "What you have told us is rubbish. The world is really a flat plate supported on the back of a giant tortoise." The scientist gave a superior smile before replying, "What is the tortoise standing on?" "You're very clever, young man, very clever," said the old lady. "But it's turtles all the way down!"`
    },
    "A People's History of the United States": {
        preview: `Arawak men and women, naked, tawny, and full of wonder, emerged from their villages onto the island's beaches and swam out to get a closer look at the strange big boat. When Columbus and his sailors came ashore, carrying swords, speaking oddly, the Arawaks ran to greet them, brought them food, water, gifts. He later wrote of this in his log:

They ... brought us parrots and balls of cotton and spears and many other things, which they exchanged for the glass beads and hawks' bells. They willingly traded everything they owned... They were well-built, with good bodies and handsome features.... They do not bear arms, and do not know them, for I showed them a sword, they took it by the edge and cut themselves out of ignorance.`
    }
};

// Hàm chia text thành các chương
const splitIntoChapters = (text, numChapters = 3) => {
    if (!text || text.trim().length === 0) {
        return [];
    }
    
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
        return [];
    }
    
    const sentencesPerChapter = Math.ceil(sentences.length / numChapters);
    const chapters = [];
    
    for (let i = 0; i < numChapters; i++) {
        const start = i * sentencesPerChapter;
        const end = Math.min(start + sentencesPerChapter, sentences.length);
        const chapterSentences = sentences.slice(start, end);
        
        if (chapterSentences.length > 0) {
            chapters.push({
                chapterNumber: i + 1,
                title: `Chương ${i + 1}`,
                content: chapterSentences.join(' ').trim()
            });
        }
    }
    
    return chapters;
};

const updatePreviewContent = async () => {
    try {
        await mongoose.connect(mongoDB);
        console.log('MongoDB connected for updating preview content...');
        
        const books = await Book.find();
        console.log(`Found ${books.length} books to update`);
        
        let updated = 0;
        let created = 0;
        
        for (const book of books) {
            const source = bookPreviewSources[book.title];
            
            if (source && source.preview) {
                const chapters = splitIntoChapters(source.preview, 3);
                
                if (chapters.length >= 3) {
                    // Tìm preview content hiện có
                    let previewContent = await PreviewContent.findOne({ book: book._id });
                    
                    if (previewContent) {
                        // Cập nhật
                        previewContent.chapters = chapters;
                        previewContent.totalChapters = chapters.length;
                        previewContent.isActive = true;
                        await previewContent.save();
                        updated++;
                        console.log(`✓ Updated preview for: ${book.title}`);
                    } else {
                        // Tạo mới
                        await PreviewContent.create({
                            book: book._id,
                            chapters,
                            totalChapters: chapters.length,
                            isActive: true
                        });
                        await Book.findByIdAndUpdate(book._id, { hasPreview: true });
                        created++;
                        console.log(`✓ Created preview for: ${book.title}`);
                    }
                } else {
                    console.log(`⚠ Not enough content for: ${book.title}`);
                }
            } else {
                console.log(`⚠ No preview source found for: ${book.title}`);
            }
        }
        
        console.log(`\n✅ Update completed!`);
        console.log(`   Created: ${created} previews`);
        console.log(`   Updated: ${updated} previews`);
        
    } catch (err) {
        console.error('Error updating preview content:', err);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

updatePreviewContent();

