import * as ui from "@minecraft/server-ui";
export function undergroundXray(player) {
    const aboutForm = new ui.ActionFormData()
        .title("X-ray Camera Is Disabled")
        .button("Okay!")
        .body(`Hey there,\nX-ray camera is §3disabled§r if you want to use it, follow these steps:\n\n1) Go to active behaviour packs in your world,\n\n2) Click on the gear/settings option,\n\n3) Then change it to X-ray §2enabled.\n`);
    return new Promise((resolve, reject) => {
        aboutForm.show(player).then(result => {
            resolve(result);
        }).catch(err => {
            reject(err);
        });
    });
}
