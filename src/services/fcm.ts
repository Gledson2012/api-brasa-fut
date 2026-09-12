import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "node:fs";
import path from "node:path";

let fcmInitialized = false;
let fcmAvailable = false;

function initFirebase() {
  if (fcmInitialized) return fcmAvailable;
  fcmInitialized = true;

  try {
    if (getApps().length > 0) {
      fcmAvailable = true;
      return true;
    }

    // 1. Verificar variável de ambiente direta (Ideal para Vercel / CI/CD)
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envServiceAccount) {
      let credentialsJson: any;
      try {
        // Suporta tanto JSON puro quanto base64
        const raw = envServiceAccount.trim().startsWith("{")
          ? envServiceAccount
          : Buffer.from(envServiceAccount, "base64").toString("utf8");
        credentialsJson = JSON.parse(raw);
      } catch (err) {
        console.warn("⚠️ [FCM] Erro ao decodificar FIREBASE_SERVICE_ACCOUNT:", err);
      }

      if (credentialsJson && credentialsJson.project_id) {
        initializeApp({
          credential: cert(credentialsJson),
        });
        fcmAvailable = true;
        console.log("🔥 [FCM] Firebase Admin inicializado com sucesso via FIREBASE_SERVICE_ACCOUNT!");
        return true;
      }
    }

    // 2. Verificar arquivos locais no workspace (google-services.json ou service-account.json)
    const possiblePaths = [
      path.resolve(process.cwd(), "service-account.json"),
      path.resolve(process.cwd(), "firebase-service-account.json"),
      path.resolve(process.cwd(), "google-services.json"),
      path.resolve(process.cwd(), "config/google-services.json"),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

          // Se for Service Account do Firebase Admin (contém private_key e client_email)
          if (content.type === "service_account" && content.private_key) {
            initializeApp({
              credential: cert(content),
            });
            fcmAvailable = true;
            console.log(`🔥 [FCM] Firebase Admin inicializado via arquivo: ${path.basename(filePath)}!`);
            return true;
          }

          // Se for google-services.json de cliente Android (tem project_info com project_id)
          if (content.project_info && content.project_info.project_id) {
            console.log(`ℹ️ [FCM] Arquivo ${path.basename(filePath)} detectado (Projeto: ${content.project_info.project_id}).`);
          }
        } catch (err) {
          console.warn(`⚠️ [FCM] Erro ao ler ${filePath}:`, err);
        }
      }
    }

    console.log("ℹ️ [FCM] Chave de serviço do Firebase não detectada. Modo simulação/dry-run ativo.");
    fcmAvailable = false;
    return false;
  } catch (error) {
    console.warn("⚠️ [FCM] Falha ao inicializar Firebase Admin:", error);
    fcmAvailable = false;
    return false;
  }
}

export interface GoalNotificationData {
  matchId: number;
  teamId: number;
  teamName: string;
  opponentName?: string;
  minute: number;
  scorerName?: string;
  homeScore: number;
  awayScore: number;
}

export class FCMService {
  /**
   * Envia uma notificação de gol para o tópico do time (ex: team_1957)
   */
  static async sendGoalNotification(data: GoalNotificationData) {
    const isReady = initFirebase();
    const topic = `team_${data.teamId}`;

    const title = `⚽ GOOOOOL DO ${data.teamName.toUpperCase()}!`;
    const scoreText = `${data.homeScore} x ${data.awayScore}`;
    const scorerText = data.scorerName ? `${data.scorerName} (${data.minute}')` : `Gol aos ${data.minute}'`;
    const body = `${scorerText} • Placar: ${scoreText} ${data.opponentName ? 'vs ' + data.opponentName : ''}`;

    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        type: "GOAL",
        matchId: String(data.matchId),
        teamId: String(data.teamId),
        teamName: String(data.teamName),
        minute: String(data.minute),
        scorerName: String(data.scorerName || ""),
        score: scoreText,
        homeScore: String(data.homeScore),
        awayScore: String(data.awayScore),
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: "high" as const,
        notification: {
          channelId: "goals_channel",
          sound: "default",
          priority: "high" as const,
        },
      },
      topic,
    };

    if (!isReady) {
      console.log(`📢 [FCM SIMULADO] Disparo de Gol para /topics/${topic}: "${title}" - "${body}"`);
      return {
        success: true,
        simulated: true,
        message: `Notificação de gol simulada com sucesso para /topics/${topic}`,
        topic,
        payload,
      };
    }

    try {
      const response = await getMessaging().send(payload);
      console.log(`✅ [FCM OFICIAL] Mensagem enviada com sucesso para /topics/${topic}. Message ID: ${response}`);
      return {
        success: true,
        simulated: false,
        messageId: response,
        topic,
        payload,
      };
    } catch (error: any) {
      console.error(`❌ [FCM ERRO] Falha ao enviar mensagem para /topics/${topic}:`, error.message);
      return {
        success: false,
        error: error.message,
        topic,
      };
    }
  }

  /**
   * Envia uma mensagem personalizada para qualquer tópico arbitrário
   */
  static async sendToTopic(topic: string, title: string, body: string, extraData: Record<string, string> = {}) {
    const isReady = initFirebase();
    const cleanTopic = topic.replace(/^\/?topics\//, "");

    const payload = {
      notification: { title, body },
      data: {
        ...extraData,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: "high" as const,
        notification: {
          channelId: "brasafut_channel",
          sound: "default",
        },
      },
      topic: cleanTopic,
    };

    if (!isReady) {
      console.log(`📢 [FCM SIMULADO] Envio para /topics/${cleanTopic}: "${title}" - "${body}"`);
      return {
        success: true,
        simulated: true,
        topic: cleanTopic,
        payload,
      };
    }

    try {
      const response = await getMessaging().send(payload);
      return {
        success: true,
        simulated: false,
        messageId: response,
        topic: cleanTopic,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        topic: cleanTopic,
      };
    }
  }
}
