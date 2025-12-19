import { UCLogger } from "@models/utils";
import { participants } from "@stores/";
import { useObserver } from "mobx-react-lite";
import { useCallback } from "react";

interface MicControlHookObservables {
  micStatus: boolean;
  isMicMutingTime: number;
}

interface MicControlReturn {
  micStatus: boolean;
  muteMic: () => void;
  unmuteMic: () => void;
}

const mediaLogger = UCLogger.getByFeature("usermedia");

/**
 * @since v1.5.0 Added to encapsulate mic mute global state manipulation
 */
export default function useMicControl(
  cooldownMs: number,
  saveConfig: boolean = true,
): MicControlReturn {
  const { micStatus, isMicMutingTime } = useObserver<MicControlHookObservables>(
    () => ({
      micStatus: participants.local.muteAudio,
      isMicMutingTime: participants.local.isMicMutingTime,
    }),
  );

  const canModifyState = useCallback((): boolean => {
    return Date.now() - isMicMutingTime > cooldownMs;
  }, [cooldownMs, isMicMutingTime]);

  const setMicState = useCallback(
    (isActive: boolean, force: boolean = false) => {
      if (canModifyState() || force) {
        mediaLogger.info(`Trying to ${isActive ? "mute" : "unmute"} microphone.`);
        participants.local.muteAudio = isActive;
        participants.local.isMicMutingTime = Date.now();
        saveConfig && participants.local.saveMediaSettingsToStorage();
      }
    },
    [canModifyState],
  );

  const unmuteMic = useCallback(() => {
    setMicState(true);
  }, [setMicState]);

  const muteMic = useCallback(() => {
    setMicState(false);
  }, [setMicState]);

  return { micStatus, muteMic, unmuteMic } as MicControlReturn;
}
