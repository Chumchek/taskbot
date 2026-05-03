import { MyContext } from '../../context';
import { adminMenuKeyboard } from '../../keyboards';
import { ADMIN_PANEL_HEADER } from '../../../i18n/ru';

export async function handleAdminCommand(ctx: MyContext): Promise<void> {
  await ctx.reply(ADMIN_PANEL_HEADER, {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}

export async function handleAdminMenu(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ADMIN_PANEL_HEADER, {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}
