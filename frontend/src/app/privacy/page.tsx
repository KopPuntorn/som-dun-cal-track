"use client";

import LegalDocumentPage from "@/components/legal/LegalDocumentPage";

export default function PrivacyPage() {
    return (
        <LegalDocumentPage
            eyebrow={{
                th: "ความเป็นส่วนตัวของบัญชี SomDun",
                en: "SomDun Account Privacy",
            }}
            title={{
                th: "นโยบายความเป็นส่วนตัว",
                en: "Privacy Policy",
            }}
            intro={{
                th: "SomDun ออกแบบมาเพื่อเก็บข้อมูลสุขภาพและโภชนาการที่จำเป็นต่อการแสดงผล dashboard, AI guidance, และประสบการณ์ติดตามผลของคุณเท่านั้น",
                en: "SomDun is designed to hold the nutrition and health data required to power your dashboard, AI guidance, and day-to-day tracking experience.",
            }}
            highlight={{
                th: "เราให้ความสำคัญกับการเก็บข้อมูลเท่าที่จำเป็น และผูกข้อมูลของคุณกับบัญชีที่คุณใช้เข้าสู่ระบบเท่านั้น",
                en: "We focus on collecting only what we need and keeping your data tied to the account you use to sign in.",
            }}
            lastUpdated="April 8, 2026"
            sections={{
                th: [
                    {
                        title: "1. ข้อมูลที่เราเก็บ",
                        body: [
                            "เราอาจเก็บข้อมูลบัญชีพื้นฐาน เช่น ชื่อ อีเมล และวิธีที่คุณใช้เข้าสู่ระบบ เพื่อให้คุณเข้าถึงบัญชีเดิมได้อย่างปลอดภัย",
                            "เมื่อคุณใช้ SomDun เราอาจเก็บข้อมูลที่คุณกรอกเอง เช่น อาหาร แคลอรี่ น้ำ กิจกรรม การนอน ค่าน้ำหนัก หรือข้อมูลวัดสัดส่วนที่คุณเลือกบันทึก",
                        ],
                    },
                    {
                        title: "2. เราใช้ข้อมูลอย่างไร",
                        body: [
                            "ข้อมูลของคุณใช้เพื่อแสดงผลหน้า Home, Dashboard, Profile และฟีเจอร์อื่นที่เกี่ยวข้องกับความคืบหน้าประจำวันของคุณ",
                            "หากคุณใช้ฟีเจอร์ AI ข้อมูลบางส่วนอาจถูกนำไปใช้เพื่อสร้างคำแนะนำหรือสรุปที่เกี่ยวข้องกับบริบทสุขภาพของคุณภายในแอปเท่านั้น",
                        ],
                    },
                    {
                        title: "3. การเก็บรักษาและความปลอดภัย",
                        body: [
                            "เราพยายามปกป้องข้อมูลด้วยระบบยืนยันตัวตนและการจัดเก็บที่เชื่อมกับบัญชีผู้ใช้ เพื่อไม่ให้ข้อมูลของคุณหลุดไปยังบัญชีอื่น",
                            "คุณควรรักษาความปลอดภัยของอีเมลและบัญชี Google ของคุณเองด้วย เพราะสิ่งเหล่านี้เป็นส่วนหนึ่งของการปกป้องบัญชี SomDun เช่นกัน",
                        ],
                    },
                    {
                        title: "4. สิทธิ์ของคุณ",
                        body: [
                            "คุณสามารถหยุดใช้งานแอปหรือหยุดบันทึกข้อมูลบางประเภทได้ทุกเมื่อ และสามารถแก้ไขข้อมูลที่คุณบันทึกไว้ในระบบได้จากหน้าต่าง ๆ ของแอป",
                            "เมื่อมีหน้า settings หรือ support flow ที่สมบูรณ์ขึ้น เราจะเพิ่มช่องทางให้จัดการข้อมูลบัญชีได้ละเอียดกว่าเดิม",
                        ],
                    },
                ],
                en: [
                    {
                        title: "1. What we collect",
                        body: [
                            "We may collect basic account details such as your name, email address, and sign-in method so you can securely return to the same account.",
                            "When you use SomDun, we may store information you choose to log, including meals, calories, hydration, activity, sleep, weight, and body metrics.",
                        ],
                    },
                    {
                        title: "2. How we use your data",
                        body: [
                            "Your data is used to power the Home, Dashboard, Profile, and other product surfaces that reflect your daily progress.",
                            "If you use AI features, selected data may be used to generate guidance or summaries that are relevant to your nutrition and wellness context inside the app.",
                        ],
                    },
                    {
                        title: "3. Storage and security",
                        body: [
                            "We aim to protect your data through account-based authentication and storage flows so your records stay associated with your own profile.",
                            "You should also protect the email account or Google account you use to sign in, because those systems are part of your SomDun account security.",
                        ],
                    },
                    {
                        title: "4. Your choices",
                        body: [
                            "You can stop using the app, stop logging certain types of data, or edit previously logged records from the product whenever those controls are available.",
                            "As SomDun grows, we plan to add more complete settings and support flows to make account-level data management easier.",
                        ],
                    },
                ],
            }}
        />
    );
}
