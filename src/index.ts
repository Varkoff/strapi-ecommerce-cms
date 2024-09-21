import type { Core } from "@strapi/strapi";
// import { Server } from "socket.io";

// export const io = new Server(strapi.server.httpServer, {
//   cors: {
//     origin: `${process.env.FRONTEND_URL}`,
//     methods: ["GET", "POST"],
//   },
// });

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    //   io.use(async (socket, next) => {
    //     try {
    //       //Socket Authentication
    //       const result = await strapi.plugins[
    //         "users-permissions"
    //       ].services.jwt.verify(socket.handshake.query.token);

    //       console.log(result);
    //       //Save the User ID to the socket connection
    //       // @ts-ignore
    //       socket.user = result.id;
    //       next();
    //     } catch (error) {
    //       console.log(error);
    //     }
    //   }).on("connection", (socket) => {
    //     // @ts-ignore
    //     socket.join(socket.user)
    //     console.log(`socket connected ${socket.id}`);
    //     socket.emit('confirmation')
    //   });
  },
};