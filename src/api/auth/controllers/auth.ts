import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "plugin::users-permissions.user",
  ({ strapi }) => ({
    async comparePasswords(ctx) {
      // @ts-ignore
      const { email, currentPassword } = ctx.request.body
      if (!email) {
        throw new Error('We need an email to use this API')
      }
      if (!currentPassword || currentPassword.length < 8) {
        throw new Error('We need a correct password to use this API')
      }

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          // @ts-ignore
          email: ctx.request.body.email
        },
      });

      const validPassword = await strapi.plugins['users-permissions'].services.user.validatePassword(currentPassword, user.password);


      return {
        isPasswordValid: validPassword
      }
    },
  })
);