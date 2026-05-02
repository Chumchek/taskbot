import { MyContext } from '../../context';
import { adminMenuKeyboard } from '../../keyboards';

export async function handleAdminCommand(ctx: MyContext): Promise<void> {
  await ctx.reply('<b>🔧 Admin Panel</b>\n\nWhat would you like to manage?', {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}

export async function handleAdminMenu(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText('<b>🔧 Admin Panel</b>\n\nWhat would you like to manage?', {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}
