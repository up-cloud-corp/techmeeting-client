import {titleStyle} from '@components/utils'
import Box from '@material-ui/core/Box'
import Button from '@material-ui/core/Button'
import Dialog, {DialogProps} from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import {t} from '@models/locales'
import errorInfo, {ErrorType} from '@stores/ErrorInfo'
import {Observer} from 'mobx-react-lite'
import React from 'react'
import {AfkDialog} from './AfkDialog'
import {TheEntrance} from './TheEntrance'
import { datadogLogs } from '@datadog/browser-logs'
 // config.js
 declare const config:any             //  from ../../config.js included from index.html

export const dialogs = new Map<ErrorType, ()=>JSX.Element>()
dialogs.set('entrance', () => <TheEntrance />)
dialogs.set('afk', () => <AfkDialog />)

export const ErrorDialogFrame: React.FC<DialogProps | {onClose:(event:{}, reason:string)=>void}> = (props) => {
  return <Dialog {...props} open={errorInfo.show()}
    onClose={props.onClose} maxWidth="md" fullWidth={false} >
  {errorInfo.title ?
    <DialogTitle id="simple-dialog-title"><span  style={titleStyle}>{errorInfo.title}</span></DialogTitle>
    : undefined }
  {props.children}
</Dialog>
}


export const ErrorDialog: React.FC = () => {
  function close(){
    // close login failed dialog. start the enter process again
    if (errorInfo.type === 'noEnterPremission'){
      errorInfo.type = 'entrance'
    }
    else if (errorInfo.type !== 'retry'){
      errorInfo.clear()
    }
  }

  return <Observer>{
    () => {
      if (errorInfo.type){
        if (dialogs.has(errorInfo.type)) {
          return dialogs.get(errorInfo.type)!()
        }else{
          // エラーダイアログの表示時のメッセージをDatadogへ送信
          if (config.datadog.use) {
            datadogLogs.logger.warn('ErrorDialog opened', { type: errorInfo.type, message: errorInfo.message })
          }
          return <ErrorDialogFrame onClose={() => { close() }}>
            <DialogContent>{errorInfo.message}</DialogContent>
            {errorInfo.type !== 'retry' ?
              <Box mt={2} mb={2} ml={4}>
              <Button variant="contained" color="primary" style={{textTransform:'none'}}
                onClick={() => { close() }} >
                {t('emClose')}
              </Button>&nbsp;
              {errorInfo.type !== 'noEnterPremission' ?
                <Button variant="contained" color="secondary" style={{textTransform:'none'}}
                  onClick={() => {
                    errorInfo.supressedTypes.add(errorInfo.type)
                    close()
                  }}>
                  {t('emNeverShow')}
                </Button> : undefined
              }
              </Box>
            : undefined}
          </ErrorDialogFrame>
        }
      }

      return <></>
    }
  }</Observer>
}
ErrorDialog.displayName = 'ErrorDialog'
