/**
 * Service to handle WhatsApp Click-to-Chat sharing without external API costs
 */
export const WhatsappService = {
  /**
   * Formats a phone number for international WhatsApp link (e.g. 05321234567 -> 905321234567)
   */
  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.length === 10 && digits.startsWith('5')) {
      return '90' + digits;
    }
    if (digits.length === 11 && digits.startsWith('05')) {
      return '9' + digits;
    }
    return digits;
  },

  /**
   * Generates WhatsApp Click-to-Chat URL
   */
  getUrl(text: string, phone?: string): string {
    const formattedPhone = this.formatPhoneNumber(phone);
    const encodedText = encodeURIComponent(text);

    if (formattedPhone) {
      return `https://wa.me/${formattedPhone}?text=${encodedText}`;
    }
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  },

  /**
   * Opens WhatsApp with pre-filled installation announcement
   */
  shareLocation(params: {
    locationName: string;
    staffName: string;
    targetPhone?: string;
  }): void {
    const { locationName, staffName, targetPhone } = params;
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const message = [
      '📍 *YENİ KURULUM BİLDİRİMİ*',
      '━━━━━━━━━━━━━━━━━━━',
      `🏢 *Kurulum:* ${locationName}`,
      `👤 *Saha Yetkilisi:* ${staffName}`,
      `📅 *Tarih:* ${dateStr} ${timeStr}`,
      '━━━━━━━━━━━━━━━━━━━',
      '🔗 *Saha Takip Paneli:*',
      'https://saha-takip-beige.vercel.app',
    ].join('\n');

    const url = this.getUrl(message, targetPhone);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },

  /**
   * Opens WhatsApp with pre-filled note / task announcement
   */
  shareNote(params: {
    content: string;
    senderName: string;
    targetUserName?: string;
    targetPhone?: string;
  }): void {
    const { content, senderName, targetUserName, targetPhone } = params;

    const message = [
      '📩 *YENİ GÖREV / NOT BİLDİRİMİ*',
      '━━━━━━━━━━━━━━━━━━━',
      `👤 *Gönderen:* ${senderName}`,
      targetUserName ? `🎯 *Kime:* ${targetUserName}` : '',
      `📝 *Not:* ${content}`,
      '━━━━━━━━━━━━━━━━━━━',
      '🔗 *Saha Takip Paneli:*',
      'https://saha-takip-beige.vercel.app',
    ]
      .filter(Boolean)
      .join('\n');

    const url = this.getUrl(message, targetPhone);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },
};
