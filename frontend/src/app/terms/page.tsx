"use client";

import LegalDocumentPage from "@/components/legal/LegalDocumentPage";

export default function TermsPage() {
    return (
        <LegalDocumentPage
            eyebrow={{
                th: "เงื่อนไขการใช้งาน SomDun",
                en: "SomDun Usage Terms",
            }}
            title={{
                th: "ข้อกำหนดการใช้งาน",
                en: "Terms of Service",
            }}
            intro={{
                th: "การใช้งาน SomDun หมายถึงคุณยอมรับข้อตกลงพื้นฐานในการใช้ระบบติดตามโภชนาการ สุขภาพ และคำแนะนำที่เกี่ยวข้องกับ performance ของคุณ",
                en: "By using SomDun, you agree to the core terms that govern the product's nutrition tracking, health logging, and performance-oriented guidance features.",
            }}
            highlight={{
                th: "SomDun เป็นเครื่องมือช่วยติดตามและให้คำแนะนำเชิงข้อมูล ไม่ใช่คำวินิจฉัยหรือการรักษาทางการแพทย์",
                en: "SomDun is a tracking and guidance tool, not a substitute for medical diagnosis or treatment.",
            }}
            lastUpdated="April 8, 2026"
            sections={{
                th: [
                    {
                        title: "1. การใช้บริการ",
                        body: [
                            "คุณสามารถใช้ SomDun เพื่อบันทึกข้อมูลอาหาร น้ำ กิจกรรม การพักฟื้น และข้อมูลสุขภาพอื่น ๆ ที่ระบบรองรับในขณะนั้น",
                            "คุณตกลงว่าจะไม่ใช้แอปเพื่อส่งข้อมูลเท็จ ทำลายระบบ รบกวนผู้ใช้อื่น หรือใช้งานในทางที่ผิดจากวัตถุประสงค์ของผลิตภัณฑ์",
                        ],
                    },
                    {
                        title: "2. บัญชีผู้ใช้",
                        body: [
                            "คุณรับผิดชอบต่อข้อมูลการเข้าสู่ระบบของตนเอง และควรใช้รหัสผ่านหรือบัญชีภายนอกที่ปลอดภัยเมื่อเข้าใช้งาน",
                            "หากมีการเข้าถึงบัญชีโดยไม่ได้รับอนุญาต คุณควรหยุดใช้งานบนอุปกรณ์ที่ไม่ปลอดภัยและเปลี่ยนวิธีการเข้าสู่ระบบที่เกี่ยวข้องทันที",
                        ],
                    },
                    {
                        title: "3. ข้อมูลและคำแนะนำจาก AI",
                        body: [
                            "ฟีเจอร์ AI ของ SomDun มีไว้เพื่อช่วยสรุป วิเคราะห์ หรือแนะนำจากข้อมูลที่คุณบันทึก แต่ผลลัพธ์อาจไม่สมบูรณ์หรือเหมาะกับทุกสถานการณ์",
                            "คุณควรใช้วิจารณญาณของตนเองเสมอ โดยเฉพาะเมื่อข้อมูลดังกล่าวเกี่ยวข้องกับสุขภาพ การออกกำลังกาย หรือการควบคุมอาหารของคุณ",
                        ],
                    },
                    {
                        title: "4. ข้อจำกัดความรับผิด",
                        body: [
                            "SomDun พยายามแสดงผลข้อมูลให้ถูกต้องที่สุดตามที่ระบบมี แต่เราไม่รับประกันว่าข้อมูลจากการสแกน การประเมิน AI หรือการคำนวณทุกอย่างจะถูกต้องสมบูรณ์เสมอไป",
                            "คุณเป็นผู้ตัดสินใจขั้นสุดท้ายในการนำข้อมูลหรือคำแนะนำจากแอปไปใช้กับร่างกาย ตารางฝึก หรือเป้าหมายสุขภาพของตนเอง",
                        ],
                    },
                ],
                en: [
                    {
                        title: "1. Using the service",
                        body: [
                            "You may use SomDun to log meals, hydration, activity, recovery, and other health-related data types supported by the product at the time.",
                            "You agree not to misuse the product by submitting fraudulent information, harming the system, disrupting other users, or using SomDun outside its intended purpose.",
                        ],
                    },
                    {
                        title: "2. Your account",
                        body: [
                            "You are responsible for keeping your own sign-in credentials secure and for using a safe password or trusted external sign-in method.",
                            "If you believe your account has been accessed without permission, you should stop using unsafe devices and change the related sign-in method as soon as possible.",
                        ],
                    },
                    {
                        title: "3. AI outputs and guidance",
                        body: [
                            "SomDun's AI features are intended to summarize, analyze, or suggest actions based on the data you log, but those outputs may not be complete or suitable for every situation.",
                            "You should use your own judgment, especially when the information relates to health, exercise, nutrition, or recovery decisions.",
                        ],
                    },
                    {
                        title: "4. Limits of responsibility",
                        body: [
                            "SomDun aims to present information accurately based on the available system inputs, but we cannot guarantee that scanning, AI estimation, or every calculation will always be fully accurate.",
                            "You remain responsible for how you apply the app's information or recommendations to your body, training schedule, and health goals.",
                        ],
                    },
                ],
            }}
        />
    );
}
