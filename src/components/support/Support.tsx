import React from "react";
import { HELP_CENTER, TYPE_CLOSE_PLUGIN } from "@constants/index";
import { sendMessageToSandBox } from "@api/index";

const Support: React.FC = () => {
    window.open(HELP_CENTER, '_blank');
    sendMessageToSandBox(true, "", TYPE_CLOSE_PLUGIN)
    return (
       <></>
    );
};

export default Support;
