if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN
const VERIFY_TOKEN = process.env.VERIFY_TOKEN

const { default: axios } = require('axios')
const express = require('express')
const app = express().use(express.json())

app.listen(process.env.PORT || 1337, () => console.log('webhook is listening.'))

app.post('/webhook', (req, res) => {
  let body = req.body
  if (body.object === 'page') {
    body.entry.forEach(async function(entry) {
      let webhook_event = entry.messaging[0]
      console.log(webhook_event)
      let sender_psid = webhook_event.sender.id
      console.log('Sender PSID: ' + sender_psid)

      console.log(await callUserProfileAPI(sender_psid))

      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message)
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback)
      }
    })

    res.status(200).send('EVENT_RECEIVED')
  } else {
    res.sendStatus(404)
  }
})

app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode']
  let token = req.query['hub.verify_token']
  let challenge = req.query['hub.challenge']
  console.log(VERIFY_TOKEN)
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED')
      res.status(200).send(challenge)
    } else {
      console.log(mode, token, challenge)
      res.sendStatus(403)
    }
  }
})

function handleMessage(sender_psid, received_message) {
  let response
  if (received_message.text) {
    const text = received_message.text
    const FACEBOOK_MESSENGER_WEBVIEW_URL =
      process.env.FACEBOOK_MESSENGER_WEBVIEW_URL

    if (text === '@activate') {
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "Activate here",
            "buttons": [
              {
                "type": "web_url",
                "title": "Activate card",
                "url": `${FACEBOOK_MESSENGER_WEBVIEW_URL}/activate`,
                "messenger_extensions": true
              }
            ]
          }
        }
      }
    } else {
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "Webview test",
            "buttons": [
              {
                "type": "web_url",
                "title": "Homepage",
                "url": FACEBOOK_MESSENGER_WEBVIEW_URL,
                "messenger_extensions": true
              }
            ]
          }
        }
      }
    }
  } else if (received_message.attachments) {
    let attachment_url = received_message.attachments[0].payload.url
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes"
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no"
              }
            ]
          }]
        }
      }
    }
  }
  callSendAPI(sender_psid, response)
}

function handlePostback(sender_psid, received_postback) {
  let response
  let payload = received_postback.payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image."}
  }
  callSendAPI(sender_psid, response)
}

async function callSendAPI(sender_psid, response) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  try {
    const sendAPIRes = await axios({
      url: '/me/messages',
      method: 'POST',
      baseURL: 'https://graph.facebook.com/v11.0/',
      params: {
        "access_token": PAGE_ACCESS_TOKEN
      },
      data: request_body
    })
    console.log('Message sent to: ' + sendAPIRes.data['recipient_id'])
  } catch (sendAPIErr) {
    console.error("Unable to send message: " + sendAPIErr)
  }
}

async function callUserProfileAPI(sender_psid) {
  try {
    const userProfileRes = await axios({
      url: `/${sender_psid}`,
      method: 'GET',
      baseURL: 'https://graph.facebook.com/v11.0/',
      params: {
        "fields": 'id,name,profile_pic',
        "access_token": PAGE_ACCESS_TOKEN
      }
    })
    return userProfileRes.data
  } catch (userProfileError) {
    console.error(userProfileError)
    return {}
  }
}
